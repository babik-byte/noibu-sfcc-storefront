import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNoibuAdapter } from '../adapters/noibu-adapter';

const CONSENT: ['necessary'] = ['necessary'];

const mockTrack = vi.fn();

beforeEach(() => {
    mockTrack.mockReset();
    (window as any).NOIBUJS = { track: mockTrack };
});

const adapter = createNoibuAdapter({});

function lastCall() {
    return { event: mockTrack.mock.calls[0][0], payload: mockTrack.mock.calls[0][1] };
}

describe('convertToProductVariant', () => {
    it('maps productId to id and sku', async () => {
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { id: 'abc123', name: 'T-Shirt', price: 29.99 } } as any,
            undefined,
            CONSENT,
        );
        const { payload } = lastCall();
        expect(payload.productVariant.id).toBe('abc123');
        expect(payload.productVariant.sku).toBe('abc123');
    });

    it('maps product name to title', async () => {
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { id: 'p1', name: 'Blue Jeans', price: 49 } } as any,
            undefined,
            CONSENT,
        );
        expect(lastCall().payload.productVariant.title).toBe('Blue Jeans');
    });

    it('maps price to price.amount', async () => {
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { id: 'p1', name: 'Hat', price: 15.5 } } as any,
            undefined,
            CONSENT,
        );
        expect(lastCall().payload.productVariant.price.amount).toBe(15.5);
    });

    it('uses masterId for product.id when available', async () => {
        await adapter.sendEvent!(
            {
                eventType: 'view_product',
                product: { id: 'variant-1', name: 'Shirt', price: 20, master: { masterId: 'master-1' } },
            } as any,
            undefined,
            CONSENT,
        );
        expect(lastCall().payload.productVariant.product.id).toBe('master-1');
    });

    it('falls back to productId for product.id when no masterId', async () => {
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { id: 'standalone-1', name: 'Mug', price: 12 } } as any,
            undefined,
            CONSENT,
        );
        expect(lastCall().payload.productVariant.product.id).toBe('standalone-1');
    });

    it('uses empty string when productId is undefined', async () => {
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { name: 'Unknown', price: 0 } } as any,
            undefined,
            CONSENT,
        );
        expect(lastCall().payload.productVariant.id).toBe('');
        expect(lastCall().payload.productVariant.sku).toBe('');
    });
});

describe('convertToCheckout', () => {
    const basket = {
        currency: 'USD',
        productSubTotal: 80,
        orderTotal: 95,
        productItems: [
            {
                itemId: 'item-1',
                productId: 'prod-1',
                quantity: 2,
                price: 40,
                product: { name: 'Sneakers', master: { masterId: 'master-prod-1' } },
            },
        ],
    };

    it('maps currency, subtotal, and total', async () => {
        await adapter.sendEvent!(
            { eventType: 'checkout_start', basket } as any,
            undefined,
            CONSENT,
        );
        const { payload } = lastCall();
        expect(payload.checkout.currencyCode).toBe('USD');
        expect(payload.checkout.subtotalPrice.amount).toBe(80);
        expect(payload.checkout.totalPrice.amount).toBe(95);
    });

    it('falls back to productSubTotal when orderTotal is absent', async () => {
        await adapter.sendEvent!(
            { eventType: 'checkout_start', basket: { ...basket, orderTotal: undefined } } as any,
            undefined,
            CONSENT,
        );
        expect(lastCall().payload.checkout.totalPrice.amount).toBe(80);
    });

    it('maps line items with id, quantity, and price', async () => {
        await adapter.sendEvent!(
            { eventType: 'checkout_start', basket } as any,
            undefined,
            CONSENT,
        );
        const [lineItem] = lastCall().payload.checkout.lineItems;
        expect(lineItem.id).toBe('item-1');
        expect(lineItem.quantity).toBe(2);
        expect(lineItem.finalLinePrice.amount).toBe(40);
    });

    it('maps line item variant via convertToProductVariant', async () => {
        await adapter.sendEvent!(
            { eventType: 'checkout_start', basket } as any,
            undefined,
            CONSENT,
        );
        const variant = lastCall().payload.checkout.lineItems[0].variant;
        expect(variant.id).toBe('prod-1');
        expect(variant.title).toBe('Sneakers');
        expect(variant.product.id).toBe('master-prod-1');
    });

    it('handles empty productItems', async () => {
        await adapter.sendEvent!(
            { eventType: 'checkout_start', basket: { ...basket, productItems: undefined } } as any,
            undefined,
            CONSENT,
        );
        expect(lastCall().payload.checkout.lineItems).toEqual([]);
    });
});

describe('sendToNoibu', () => {
    it('queues events fired before the SDK is ready and sends each once on noibuSDKReady', async () => {
        delete (window as any).NOIBUJS;
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { id: 'p1', name: 'Hat', price: 10 } } as any,
            undefined,
            CONSENT,
        );
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { id: 'p2', name: 'Cap', price: 12 } } as any,
            undefined,
            CONSENT,
        );
        expect(mockTrack).not.toHaveBeenCalled();

        (window as any).NOIBUJS = { track: mockTrack };
        window.dispatchEvent(new Event('noibuSDKReady'));
        expect(mockTrack).toHaveBeenCalledTimes(2);
        expect(mockTrack.mock.calls[0][1].productVariant.id).toBe('p1');
        expect(mockTrack.mock.calls[1][1].productVariant.id).toBe('p2');

        // { once: true } — a second noibuSDKReady must not re-send queued events
        window.dispatchEvent(new Event('noibuSDKReady'));
        expect(mockTrack).toHaveBeenCalledTimes(2);
    });

    it('logs a warning when track() reports failure', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockTrack.mockReturnValue({ success: false, errors: ['missing field'] });
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { id: 'p1', name: 'Hat', price: 10 } } as any,
            undefined,
            CONSENT,
        );
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Noibu rejected an ecommerce event'),
            expect.stringContaining('missing field'),
        );
        warnSpy.mockRestore();
    });

    it('does not log when track() succeeds', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockTrack.mockReturnValue({ success: true, errors: [] });
        await adapter.sendEvent!(
            { eventType: 'view_product', product: { id: 'p1', name: 'Hat', price: 10 } } as any,
            undefined,
            CONSENT,
        );
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe('pendingCheckout lifecycle', () => {
    const basket = {
        currency: 'USD',
        productSubTotal: 50,
        orderTotal: 55,
        productItems: [{ itemId: 'i1', productId: 'p1', quantity: 1, price: 50, product: { name: 'Hat' } }],
    };

    function placeOrderStep() {
        return adapter.sendEvent!(
            { eventType: 'checkout_step', stepName: 'PLACE_ORDER', stepNumber: 5, basket } as any,
            undefined,
            CONSENT,
        );
    }

    function viewPage(path: string) {
        return adapter.sendEvent!({ eventType: 'view_page', path } as any, undefined, CONSENT);
    }

    function completedEvents() {
        return mockTrack.mock.calls.filter(([name]) => name === 'checkout_completed');
    }

    it('sends checkout_completed with the order id on the confirmation page after PLACE_ORDER', async () => {
        await placeOrderStep();
        await viewPage('/order-confirmation/ORD-1');
        const completed = completedEvents();
        expect(completed).toHaveLength(1);
        expect(completed[0][1].checkout.order.id).toBe('ORD-1');
        expect(completed[0][1].checkout.totalPrice.amount).toBe(55);
    });

    it('keeps the snapshot across checkout page views (tracker re-fires /checkout after place-order revalidation)', async () => {
        await placeOrderStep();
        await viewPage('/site4/en-US/checkout');
        await viewPage('/site4/en-US/order-confirmation/ORD-1B');
        const completed = completedEvents();
        expect(completed).toHaveLength(1);
        expect(completed[0][1].checkout.order.id).toBe('ORD-1B');
    });

    it('discards the snapshot when the shopper leaves checkout after PLACE_ORDER', async () => {
        await placeOrderStep();
        await viewPage('/cart');
        await viewPage('/order-confirmation/ORD-OLD');
        expect(completedEvents()).toHaveLength(0);
    });

    it('does not fire on a direct confirmation-page visit with no pending order', async () => {
        await viewPage('/order-confirmation/ORD-STRAY');
        expect(completedEvents()).toHaveLength(0);
    });

    it('does not reuse a consumed snapshot on a second confirmation view', async () => {
        await placeOrderStep();
        await viewPage('/order-confirmation/ORD-2');
        await viewPage('/order-confirmation/ORD-2');
        expect(completedEvents()).toHaveLength(1);
    });
});
