import type { AnalyticsEvent, ConsentCategory, ConsentPreferences, EventSiteInfo } from '@salesforce/storefront-next-runtime/events';
import type { ShopperBasketsV2, ShopperProducts } from '@salesforce/storefront-next-runtime/scapi';
import { hasConsent } from '@/lib/adapters';
import type { EngagementAdapter } from '@/lib/adapters';

export const NOIBU_ADAPTER_NAME = 'noibu' as const;

type NoibuMoney = { amount?: number; currencyCode?: string };
type NoibuProduct = { id?: string; title?: string };
type NoibuProductVariant = { id?: string; sku?: string; title?: string; price?: NoibuMoney; product?: NoibuProduct };
type NoibuCartLine = { merchandise?: NoibuProductVariant; quantity?: number; cost?: { totalAmount?: NoibuMoney } };
type NoibuCheckoutLineItem = { id?: string; quantity?: number; finalLinePrice?: NoibuMoney; variant?: NoibuProductVariant };
type NoibuCheckout = { currencyCode?: string; subtotalPrice?: NoibuMoney; totalPrice?: NoibuMoney; lineItems?: NoibuCheckoutLineItem[] };
type NoibuSearchResult = { query?: string; productVariants?: NoibuProductVariant[] };
type NoibuCollection = { id?: string; title?: string; productVariants?: NoibuProductVariant[] };

type NoibuEvents = {
    product_viewed: { productVariant?: NoibuProductVariant };
    product_added_to_cart: { cartLine?: NoibuCartLine };
    checkout_started: { checkout?: NoibuCheckout };
    checkout_contact_info_submitted: { checkout?: NoibuCheckout };
    checkout_address_info_submitted: { checkout?: NoibuCheckout };
    checkout_shipping_info_submitted: { checkout?: NoibuCheckout };
    payment_info_submitted: { checkout?: NoibuCheckout };
    search_submitted: { searchResult?: NoibuSearchResult };
    collection_viewed: { collection?: NoibuCollection };
    checkout_completed: { checkout?: NoibuCheckout };
};

type NoibuEventName = keyof NoibuEvents;

type NoibuWindow = Window & {
    NOIBUJS?: {
        track: <T extends NoibuEventName>(eventName: T, payload: NoibuEvents[T]) => { success: boolean; errors: string[] };
    };
};

export type NoibuAdapterConfig = {
    consentCategory?: ConsentCategory;
};

const STEP_TO_NOIBU_EVENT: Record<string, NoibuEventName | undefined> = {
    SHIPPING_ADDRESS: 'checkout_contact_info_submitted',
    SHIPPING_OPTIONS: 'checkout_address_info_submitted',
    PAYMENT: 'checkout_shipping_info_submitted',
    PLACE_ORDER: 'payment_info_submitted',
};

function sendToNoibu<T extends NoibuEventName>(eventName: T, payload: NoibuEvents[T]): void {
    const run = () => (window as NoibuWindow).NOIBUJS?.track(eventName, payload);
    if ((window as NoibuWindow).NOIBUJS) {
        run();
    } else {
        window.addEventListener('noibuSDKReady', run);
    }
}

function convertToProductVariant(
    productId: string | undefined,
    productData: Partial<ShopperProducts.schemas['Product']> | undefined,
    price: number | undefined,
): NoibuProductVariant {
    const id = productId ?? '';
    return {
        id,
        sku: id,
        title: productData?.name,
        price: { amount: price },
        product: {
            id: productData?.master?.masterId ?? id,
            title: productData?.name,
        },
    };
}

function convertToCheckout(basket: ShopperBasketsV2.schemas['Basket']): NoibuCheckout {
    return {
        currencyCode: basket.currency,
        subtotalPrice: { amount: basket.productSubTotal },
        totalPrice: { amount: basket.orderTotal ?? basket.productSubTotal },
        lineItems: (basket.productItems ?? []).map((item) => {
            const productData = item.product as Partial<ShopperProducts.schemas['Product']> | undefined;
            return {
                id: item.itemId,
                quantity: item.quantity,
                finalLinePrice: { amount: item.price },
                variant: convertToProductVariant(item.productId, productData, item.price),
            };
        }),
    };
}

export function createNoibuAdapter(config: NoibuAdapterConfig): EngagementAdapter {
    return {
        name: NOIBU_ADAPTER_NAME,

        sendEvent: async (
            event: AnalyticsEvent,
            _siteInfo?: EventSiteInfo,
            consentPreferences?: ConsentPreferences,
        ): Promise<void> => {
            if (!hasConsent(config.consentCategory, consentPreferences)) return;

            switch (event.eventType) {
                case 'view_product':
                    sendToNoibu('product_viewed', {
                        productVariant: convertToProductVariant(event.product.id, event.product, event.product.price),
                    });
                    break;

                case 'cart_item_add':
                    for (const item of event.cartItems) {
                        const productData = item.product as Partial<ShopperProducts.schemas['Product']> | undefined;
                        sendToNoibu('product_added_to_cart', {
                            cartLine: {
                                merchandise: convertToProductVariant(item.productId, productData, item.price),
                                quantity: item.quantity ?? 0,
                                cost: { totalAmount: { amount: (item.price ?? 0) * (item.quantity ?? 0) } },
                            },
                        });
                    }
                    break;

                case 'view_search':
                    sendToNoibu('search_submitted', {
                        searchResult: {
                            query: event.searchInputText,
                            productVariants: event.searchResults.map((hit) =>
                                convertToProductVariant(hit.productId, { name: hit.productName }, hit.price),
                            ),
                        },
                    });
                    break;

                case 'view_category':
                    sendToNoibu('collection_viewed', {
                        collection: {
                            id: event.category.id,
                            title: event.category.name,
                            productVariants: event.searchResults.map((hit) =>
                                convertToProductVariant(hit.productId, { name: hit.productName }, hit.price),
                            ),
                        },
                    });
                    break;

                case 'checkout_start':
                    sendToNoibu('checkout_started', {
                        checkout: convertToCheckout(event.basket),
                    });
                    break;

                case 'checkout_step': {
                    const noibuEvent = STEP_TO_NOIBU_EVENT[event.stepName];
                    if (noibuEvent) {
                        const checkout = convertToCheckout(event.basket);
                        sendToNoibu(noibuEvent, { checkout });
                        if (event.stepName === 'PLACE_ORDER') {
                            sendToNoibu('checkout_completed', { checkout });
                        }
                    }
                    break;
                }

                default:
                    break;
            }
        },
    };
}
