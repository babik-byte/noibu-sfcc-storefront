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
 * Hooks for the mini cart: fetches the basket alongside full product details (images, variations,
 * promotions) in a single resource-route round-trip, and exposes an imperative loader form for
 * prefetching from the cart-badge hover/focus handlers.
 *
 * DESIGN NOTE — single source of truth for the mini cart
 * ------------------------------------------------------
 * The cart sheet reads `basket` from the fetcher returned here, NOT from `useBasket()` (BasketContext). This is
 * deliberate. Do not "simplify" by routing the cart-sheet's basket through context — that reverts the optimization and
 * reintroduces a second SCAPI round-trip per mini-cart open. If you need the basket somewhere else, use `useBasket()`.
 * The cart-sheet specifically needs basket AND productsById from the same SCAPI snapshot to render correctly — that's
 * why it reads both from here.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFetcher } from 'react-router';
import type { ShopperBasketsV2, ShopperProducts } from '@/scapi';
import type { loader as basketProductsLoader } from '@/routes/resource.basket-products';
import type { ProductsWithPromotionsMap } from '@/lib/cart/bonus-product-utils';
import { findImageGroupBy } from '@/lib/product/image-groups-utils';
import { useBasketSnapshot, useBasketUpdater } from '@/providers/basket';
import { resourceRoutes } from '@/route-paths';

/**
 * A basket product item enriched with full product details (images, variations, etc.)
 * Combines basket item data with product catalog data for display purposes
 */
export type BasketItemWithProduct = ShopperBasketsV2.schemas['ProductItem'] &
    Partial<ShopperProducts.schemas['Product']> & {
        isProductUnavailable?: boolean;
    };

interface UseMiniCartDataResult {
    basket: ShopperBasketsV2.schemas['Basket'] | null | undefined;
    productItems: BasketItemWithProduct[];
    productsById: ProductsWithPromotionsMap;
    isLoading: boolean;
    error: Error | null;
}

// Shared React Router fetcher key for the basket-products resource. Both useMiniCartData (mounted by the cart
// sheet) and useMiniCartDataLoader (used for prefetch) attach to this key so they observe the same fetcher state
// — a prefetch in flight is reused by the cart sheet rather than dispatched a second time.
const MINI_CART_FETCHER_KEY = 'basket-products';
const MINI_CART_RESOURCE_URL = resourceRoutes.basketProducts;

/**
 * Imperative loader for the mini-cart resource. Returns a reference-stable callback that dispatches a load if
 * the shared fetcher is idle and has no data, and is a no-op otherwise. Calling this hook allocates a React Router
 * fetcher slot on every page that mounts it, but no network call fires until the returned callback is invoked.
 *
 * Used by the cart-badge to pre-warm on hover/focus so basket + product data is in cache by the time the panel mounts.
 *
 * Skips when no basketId is known in the snapshot or when the snapshot reports an empty basket — without an existing
 * basket there's nothing to enrich, and an empty basket has no line items to enrich either; triggering the resource
 * route would round-trip for no gain. Empty-basket trust is cookie-based, so a stale "empty" cookie can briefly hide
 * a cross-tab add, but the next loader run reconciles via the basket middleware.
 */
export function useMiniCartDataLoader(): () => void {
    const fetcher = useFetcher<typeof basketProductsLoader>({ key: MINI_CART_FETCHER_KEY });
    const snapshot = useBasketSnapshot();

    // useFetcher returns a fresh object every render and the snapshot can flip on cookie updates. Mirror both
    // into refs so the returned callback can have empty useCallback deps and stay reference-stable across renders.
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    return useCallback(() => {
        const snap = snapshotRef.current;
        if (!snap?.basketId || snap.totalItemCount === 0) {
            return;
        }
        const f = fetcherRef.current;
        if (f.state === 'idle' && !f.data) {
            void f.load(MINI_CART_RESOURCE_URL);
        }
    }, []);
}

const deriveVariationValuesFromAttributes = (
    variationAttributes: ShopperProducts.schemas['VariationAttribute'][] | undefined
): Record<string, string> | undefined => {
    if (!variationAttributes?.length) return undefined;

    const selected = variationAttributes.reduce<Record<string, string>>((acc, attribute) => {
        const value = attribute.values?.length === 1 ? attribute.values[0]?.value : undefined;
        if (attribute.id && value) {
            acc[attribute.id] = value;
        }
        return acc;
    }, {});

    return Object.keys(selected).length > 0 ? selected : undefined;
};

const normalizeVariationValues = (value: unknown): Record<string, string> | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const entries = Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'
    );
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const getFallbackImageGroup = (
    imageGroups: ShopperProducts.schemas['ImageGroup'][] | undefined
): ShopperProducts.schemas['ImageGroup'] | undefined => {
    if (!imageGroups?.length) return undefined;

    const smallGroups = imageGroups.filter((group) => group.viewType === 'small');
    if (smallGroups.length === 0) return undefined;

    return smallGroups.find((group) => !group.variationAttributes?.length) ?? smallGroups[0];
};

/**
 * Fetches the basket plus full product details (images, variations, promotions) and merges the two into enriched
 * line items. Loads on first mount; React Router auto-revalidates the fetcher after sibling action submissions
 * (e.g. cart-item-remove), so additions/removals propagate without additional plumbing.
 */
export function useMiniCartData(): UseMiniCartDataResult {
    // Shared fetcher key so prefetch (e.g. on cart-badge hover via useMiniCartDataLoader) and the cart-sheet
    // panel observe the same fetcher state — avoids a duplicate request when click follows a hover prefetch. We can't
    // delegate to useMiniCartDataLoader here because this hook reads fetcher state/data for the merge logic.
    const fetcher = useFetcher<typeof basketProductsLoader>({ key: MINI_CART_FETCHER_KEY });
    const { state: fetcherState, data: fetcherData, load: loadMiniCart } = fetcher;
    const snapshot = useBasketSnapshot();
    const snapshotBasketId = snapshot?.basketId;
    const snapshotTotalItemCount = snapshot?.totalItemCount ?? 0;

    // Trigger the load once on mount. The fetcher dedupes against in-flight or completed loads. Skip when no basketId
    // is known or when the snapshot reports an empty basket — without an existing basket there is nothing to fetch,
    // and an empty basket has no line items to enrich; the panel renders the empty-cart state via the gate in
    // `isLoading` below. Re-fires when totalItemCount transitions 0 → N (add-to-cart from an empty cart updates the
    // cookie) so the first load dispatches at that point. Empty-basket trust is cookie-based — see the docblock on
    // useMiniCartDataLoader for the divergence tradeoff.
    useEffect(() => {
        if (!snapshotBasketId || snapshotTotalItemCount === 0) {
            return;
        }
        if (fetcherState === 'idle' && !fetcherData) {
            void loadMiniCart(MINI_CART_RESOURCE_URL);
        }
    }, [snapshotBasketId, snapshotTotalItemCount, fetcherState, fetcherData, loadMiniCart]);

    // Publish the fetched basket into BasketProvider so badge count and other useBasket() consumers stay in sync.
    // Reads no value from BasketContext, so writing back here cannot create a render loop. updateBasket is
    // reference-stable.
    //
    // Key the effect on `basketId + lastModified` rather than the fetcherData object itself: React Router's fetcher
    // returns a fresh data object on every revalidation, even when SCAPI returns identical content. Without this guard,
    // every harmless revalidation would call updateBasket(), and even though the basket updater dedups by lastModified
    // internally, running the publisher body N times per session is wasted work. The basket payload is read through a
    // ref so the effect body sees the current value while the dep array tracks only the identity-defining fields.
    const updateBasket = useBasketUpdater();
    const fetchedBasket = fetcherData?.basket;
    const fetchedBasketRef = useRef(fetchedBasket);
    fetchedBasketRef.current = fetchedBasket;
    const fetchedBasketId = fetchedBasket?.basketId;
    const fetchedLastModified = fetchedBasket?.lastModified;
    useEffect(() => {
        const fetched = fetchedBasketRef.current;
        if (fetched?.basketId) {
            updateBasket(fetched);
        }
    }, [fetchedBasketId, fetchedLastModified, updateBasket]);

    const basket = fetcherData?.basket ?? null;
    const productsById = useMemo<ProductsWithPromotionsMap>(() => fetcherData?.productsById ?? {}, [fetcherData]);

    const enriched = useMemo<{ productItems: BasketItemWithProduct[]; error: Error | null }>(() => {
        const productItems = basket?.productItems;
        if (!productItems?.length) {
            return { productItems: [], error: null };
        }

        // No product data yet — show basic basket items so the panel reflects the line items immediately.
        if (!fetcherData) {
            return { productItems, error: null };
        }

        try {
            const basketProductIds = productItems
                .map((item) => item.productId)
                .filter((id): id is string => Boolean(id));
            const hasAllCurrentProductData = basketProductIds.every((productId) => Boolean(productsById[productId]));

            // Avoid mixing stale fetcher data with the current basket while a refresh is in flight.
            if (!hasAllCurrentProductData) {
                return { productItems, error: null };
            }

            // Deliberate fork of `getEnrichedProducts` (lib/product/product-utils.ts). The mini cart adds single-value
            // variation derivation, SKU-first image fallback, and the stale-data guard above — all fetcher-specific
            // concerns we don't want pushed into the synchronous checkout helper.
            const enrichedItems: BasketItemWithProduct[] = productItems.map((item) => {
                const productId = item.productId;
                if (!productId || !productsById[productId]) {
                    return item;
                }

                const fullProduct = productsById[productId];
                const explicitImageVariationValues =
                    normalizeVariationValues(item.variationValues) ||
                    normalizeVariationValues(fullProduct.variationValues);
                const derivedDisplayVariationValues = deriveVariationValuesFromAttributes(
                    fullProduct.variationAttributes
                );
                const resolvedVariationValues = explicitImageVariationValues || derivedDisplayVariationValues;

                // SKU-first image strategy:
                // 1) Prefer SKU-resolved product image groups directly (fallback group)
                // 2) Only apply variation filtering when explicit variation values are present
                const imageGroup =
                    (explicitImageVariationValues
                        ? findImageGroupBy(fullProduct.imageGroups, {
                              viewType: 'small',
                              selectedVariationAttributes: explicitImageVariationValues,
                          })
                        : undefined) ?? getFallbackImageGroup(fullProduct.imageGroups);

                return {
                    ...item,
                    ...fullProduct,
                    // Preserve basket-specific data (only override if item has the value)
                    itemId: item.itemId,
                    quantity: item.quantity,
                    price: item.price,
                    priceAfterItemDiscount: item.priceAfterItemDiscount,
                    // Keep line-item values, then product values, then derive from single-value variation attrs.
                    variationValues: resolvedVariationValues,
                    // Keep fullProduct.variationAttributes for proper display names
                    variationAttributes: fullProduct.variationAttributes,
                    // Use the correct image for the variation
                    imageGroups: imageGroup ? [imageGroup] : fullProduct.imageGroups,
                };
            });

            return { productItems: enrichedItems, error: null };
        } catch (err) {
            return {
                productItems,
                error: err instanceof Error ? err : new Error('Unknown error'),
            };
        }
    }, [basket, fetcherData, productsById]);

    // Treat "no data yet" as loading so a cold open (touch device, external setMiniCartOpen(true), no prefetch)
    // renders the loading state instead of the empty-cart state for the one frame before the fetcher resolves.
    // `idle && !fetcherData` covers the brief window between mount and the load() effect dispatching.
    //
    // Exception: when there is no basketId or when the snapshot reports an empty basket, we have intentionally not
    // dispatched a load — the panel should render the empty-cart state, not a permanent spinner. Mirrors the
    // cart-badge prefetch gate.
    const isLoading =
        Boolean(snapshotBasketId) && snapshotTotalItemCount > 0 && (fetcherState !== 'idle' || !fetcherData);

    return {
        basket,
        productItems: enriched.productItems,
        productsById,
        isLoading,
        error: enriched.error,
    };
}
