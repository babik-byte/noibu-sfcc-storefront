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
