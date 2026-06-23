/**
 * Copyright 2026 Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Resource route to fetch the basket and full product details for its items in a single round-trip.
 * Called by the mini cart to populate basket data, product images/variations, and promotion callouts.
 */

import type { ShouldRevalidateFunction } from 'react-router';
import type { Route } from './+types/resource.basket-products';
import type { ShopperBasketsV2 } from '@/scapi';
import { getBasket } from '@/middlewares/basket.server';
import { createApiClients } from '@/lib/api-clients.server';
import { getConfig } from '@salesforce/storefront-next-runtime/config';
import { siteContext } from '@salesforce/storefront-next-runtime/site-context';
// @sfdc-extension-block-start SFDC_EXT_BOPIS
import { getInventoryIdsFromPickupShipments } from '@/extensions/bopis/lib/basket-utils';
// @sfdc-extension-block-end SFDC_EXT_BOPIS
import { getLogger } from '@/lib/logger.server';
import type { ProductWithPromotions, ProductsWithPromotionsMap } from '@/lib/cart/bonus-product-utils';

export type BasketProductsLoaderData = {
    basket: ShopperBasketsV2.schemas['Basket'] | null;
    productsById: ProductsWithPromotionsMap;
};

export const shouldRevalidate: ShouldRevalidateFunction = ({ formAction, actionResult, defaultShouldRevalidate }) => {
    // Action submissions: opt in only when the action returned a basket payload. Basket-mutating actions follow the
    // BasketActionResponse shape ({ success, basket, ... }); non-basket actions (wishlist, locale, OTP, ...) return
    // responses without `basket`, so we skip the SCAPI round-trip per unrelated submission.
    if (formAction) {
        return Boolean((actionResult as { basket?: { basketId?: string } } | undefined)?.basket?.basketId);
    }
    // Navigation or imperative useRevalidator().revalidate() (e.g. post-login basket merge): defer to React Router's
    // default, which only revalidates when params/URL actually changed.
    return defaultShouldRevalidate;
};

/**
 * Fetches the basket and full product details for all items in it.
 * Returns the basket and a mapping of productId to full product data with an explicit, minimal
 * expand list scoped to fields the mini cart UI consumes.
 */
export async function loader({ context }: Route.LoaderArgs): Promise<BasketProductsLoaderData> {
    const logger = getLogger(context);
    logger.debug('BasketProducts: loader starting');
    const basket = (await getBasket(context, { ensureBasket: 'read' })).current ?? null;

    if (!basket?.productItems?.length) {
        logger.debug('BasketProducts: no product items in basket');
        return { basket, productsById: {} };
    }

    // Collect all product IDs from basket items
    const productIds = basket.productItems.map((item) => item.productId).filter((id): id is string => Boolean(id));

    if (productIds.length === 0) {
        logger.debug('BasketProducts: no valid product IDs found');
        return { basket, productsById: {} };
    }

    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    // Collect unique inventory IDs from pickup shipments to fetch store-level inventory
    const inventoryIds = getInventoryIdsFromPickupShipments(basket);
    // @sfdc-extension-block-end SFDC_EXT_BOPIS

    try {
        const config = getConfig(context);
        const clients = createApiClients(context);
        const siteCtx = context.get(siteContext);
        if (!siteCtx) {
            logger.error('BasketProducts: site context is not available');
            throw new Response('Site context is not available', { status: 500 });
        }
        const { site, currency } = siteCtx;

        // Scope expansions to only what the mini cart UI consumes. Without an explicit expand,
        // the SCAPI default returns extra blocks (set_products, recommendations, links, options,
        // custom_properties, validation, bundled_products) that the mini cart never reads.
        const { data: productsData } = await clients.shopperProducts.getProducts({
            params: {
                path: {
                    organizationId: config.commerce.api.organizationId,
                },
                query: {
                    siteId: site.id,
                    ids: productIds,
                    allImages: true,
                    perPricebook: true,
                    ...(currency ? { currency } : {}),
                    expand: ['availability', 'images', 'prices', 'promotions', 'variations'],
                    // @sfdc-extension-block-start SFDC_EXT_BOPIS
                    // Include store inventory IDs for pickup items
                    ...(inventoryIds.length > 0 ? { inventoryIds } : {}),
                    // @sfdc-extension-block-end SFDC_EXT_BOPIS
                },
            },
        });

        if (!productsData?.data) {
            return { basket, productsById: {} };
        }

        const productsById = productsData.data.reduce((acc, product) => {
            acc[product.id] = product as ProductWithPromotions;
            return acc;
        }, {} as ProductsWithPromotionsMap);

        return { basket, productsById };
    } catch (error) {
        logger.error('BasketProducts: failed to fetch product details', { error });
        // Return basket on error - mini cart can still display basic basket data
        return { basket, productsById: {} };
    }
}
