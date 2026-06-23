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
import { type ReactElement, Suspense, useState } from 'react';

// React Router
import { Await, useLoaderData } from 'react-router';
import type { Route } from './+types/_app.cart';

// Commerce SDK
import { type ShopperBasketsV2, type ShopperProducts, type ShopperPromotions, type ShopperStores } from '@/scapi';

// Middlewares
import { getBasket, getBasketSnapshot, type BasketSnapshot } from '@/middlewares/basket.server';

// Cart orchestrators
import { fetchProductsInBasket } from '@/lib/cart/basket-products.server';
import { fetchPromotionsForBasket } from '@/lib/cart/basket-promotions.server';
import { fetchWishlistProductIdsForCart } from '@/lib/cart/cart-wishlist.server';
import { fetchWishlistInitialState } from '@/lib/wishlist/fetch-initial-state.server';
import type { WishlistInitialState } from '@/lib/wishlist/state';
import { WishlistProvider } from '@/providers/wishlist';
import { fetchProductRecommendations } from '@/lib/product/recommendations.server';
import { EINSTEIN_RECOMMENDERS } from '@/lib/adapters/engagement/einstein-recommenders';
import { siteContext } from '@salesforce/storefront-next-runtime/site-context';
import type { Recommendation } from '@/hooks/recommenders/use-recommenders';

// Components
import CartSkeleton from '@/components/cart/cart-skeleton';
import CartContent from '@/components/cart/cart-content';
import { CartLoadError } from '@/components/cart/cart-load-error';
import { SeoMeta } from '@/components/seo-meta';
import DeferredProductRecommendations from '@/components/product-recommendations/deferred';
import { ProductRecommendationSkeleton } from '@/components/product/skeletons';
import { buildCanonicalUrl } from '@/utils/canonical-url';
import { useTranslation } from 'react-i18next';
// @sfdc-extension-block-start SFDC_EXT_BOPIS
import { fetchStoresForBasket } from '@/extensions/bopis/lib/api/stores.server';
import PickupProvider from '@/extensions/bopis/context/pickup-context';
// @sfdc-extension-block-end SFDC_EXT_BOPIS

/**
 * Data structure returned by the cart loader.
 *
 * `basketDataPromise` is a single deferred promise: when any of basket, products, promotions,
 * or stores fails, the route's `<Await errorElement={<CartLoadError/>}>` renders an in-page
 * error UI. `wishlistProductIdsPromise` is split out so a wishlist failure can silently
 * degrade without blocking the rest of the cart.
 *
 * When BOPIS is stripped, `storesByStoreId` is always `{}`.
 */
type CartPageData = {
    basketDataPromise: Promise<{
        basket: ShopperBasketsV2.schemas['Basket'];
        productsByItemId: Record<string, ShopperProducts.schemas['Product']>;
        bonusProductsById: Record<string, ShopperProducts.schemas['Product']>;
        promotions: Record<string, ShopperPromotions.schemas['Promotion']>;
        storesByStoreId: Record<string, ShopperStores.schemas['Store']>;
    }>;
    wishlistProductIdsPromise: Promise<string[]>;
    wishlistInitialState: Promise<WishlistInitialState>;
    cartMayAlsoLikePromise: Promise<Recommendation>;
    cartRecentlyViewedPromise: Promise<Recommendation>;
    basketSnapshot: BasketSnapshot | null;
    pageUrl: string;
};

/**
 * Server-side loader for the cart route.
 *
 * Returns deferred promises only — no `try/catch`, no logging. The API layer (`lib/api/**`,
 * `extensions/bopis/lib/api/`) wraps every `clients.*` call with logging + `NormalizedApiError`,
 * and `<Await errorElement>` boundaries on the render handle rejections.
 *
 * The basket+products+promotions+stores share `basketDataPromise` (one error UI for any
 * cart-blocking failure). Wishlist is split out so a wishlist failure degrades silently.
 */
export const loader = ({ context, request }: Route.LoaderArgs): CartPageData => {
    const requestUrl = new URL(request.url);
    const pageUrl = buildCanonicalUrl(requestUrl.origin, requestUrl.pathname, requestUrl.search);
    const currency = context.get(siteContext)?.currency;

    const basketDataPromise = (async () => {
        const basketResource = await getBasket(context, { ensureBasket: true });
        const basket = basketResource.current ?? ({} as ShopperBasketsV2.schemas['Basket']);

        // Default for stripped BOPIS — reassigned inside the extension block when present.
        let storesByStoreIdRawPromise: Promise<
            Record<string, ShopperStores.schemas['Store']> | Map<string, ShopperStores.schemas['Store']>
        > = Promise.resolve({});
        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        storesByStoreIdRawPromise = fetchStoresForBasket(context, basket);
        // @sfdc-extension-block-end SFDC_EXT_BOPIS

        const [{ productsByItemId, bonusProductsById }, promotions, storesByStoreIdRaw] = await Promise.all([
            fetchProductsInBasket(context, basket),
            fetchPromotionsForBasket(context, basket?.productItems ?? []),
            storesByStoreIdRawPromise,
        ]);

        return {
            basket,
            productsByItemId,
            bonusProductsById,
            promotions,
            storesByStoreId:
                storesByStoreIdRaw instanceof Map ? Object.fromEntries(storesByStoreIdRaw) : (storesByStoreIdRaw ?? {}),
        };
    })();

    const wishlistProductIdsPromise = fetchWishlistProductIdsForCart(context);

    // CART_MAY_ALSO_LIKE wants products as input — chain off basketDataPromise so we get productsByItemId without
    // awaiting it inline. If basketDataPromise itself rejects, the surrounding cart UI already shows CartLoadError,
    // so we silently degrade here.
    const cartMayAlsoLikePromise = basketDataPromise
        .then(({ productsByItemId }) =>
            fetchProductRecommendations(
                { context, request },
                {
                    name: EINSTEIN_RECOMMENDERS.CART_MAY_ALSO_LIKE,
                    products: Object.values(productsByItemId),
                    ...(currency ? { currency } : {}),
                }
            )
        )
        .catch((): Recommendation => ({}));

    // CART_RECENTLY_VIEWED is identity-only (cookieId/userId), no product input — fire immediately.
    const cartRecentlyViewedPromise = fetchProductRecommendations(
        { context, request },
        { name: EINSTEIN_RECOMMENDERS.CART_RECENTLY_VIEWED, ...(currency ? { currency } : {}) }
    );

    return {
        basketDataPromise,
        wishlistProductIdsPromise,
        wishlistInitialState: fetchWishlistInitialState(context),
        cartMayAlsoLikePromise,
        cartRecentlyViewedPromise,
        basketSnapshot: getBasketSnapshot(context),
        pageUrl,
    };
};

/**
 * Cart route component.
 *
 * Two `<Await>` boundaries, both at the route level (no Suspense/Await embedded inside cart
 * components — embedding Suspense/Await deeper can cause re-suspension on loader revalidation
 * and orphan in-flight `useFetcher` submissions).
 *
 *   - Outer: `basketDataPromise`. On rejection, `<CartLoadError/>` renders an in-page error
 *     with retry. HTTP status stays 200.
 *   - Inner (over wishlist seed): `<CartBody>` is rendered identically in both the Suspense
 *     fallback (with `wishlistProductIds={[]}`) and the resolved branch (with the real ids),
 *     so the cart appears immediately and React reconciles the same `<CartBody>` tree without
 *     unmounting/remounting when wishlist resolves. The wishlist promise is pinned via lazy
 *     `useState` so cart-mutating revalidations cannot re-suspend this Await.
 *
 * Wishlist failure silently degrades — `errorElement` renders `<CartBody>` with `[]`.
 */
export default function Cart(): ReactElement {
    const { t } = useTranslation('cart');
    const { t: tProduct } = useTranslation('product');
    const pageData = useLoaderData<typeof loader>();

    // Pin the wishlist promise to its first reference for the lifetime of this component
    // instance. The wishlist seed is a one-shot init value (cart-line wishlist hooks track
    // their own state after mount), so we never want it refreshed by a revalidation. Without
    // pinning, any cart-mutating action (cart-item-update, bonus-product-add, wishlist-add
    // from a cart line, etc.) triggers route revalidation → fresh promise reference →
    // <Await> re-suspends → cart-line Suspense subtrees unmount → in-flight useFetcher
    // instances (wishlist toggle, quantity update) get orphaned.
    const [pinnedWishlistPromise] = useState(() => pageData.wishlistProductIdsPromise);

    // Same rationale for the new wishlist provider's initial-state seed: pin so cart
    // revalidations (basket mutations re-run the loader and produce a fresh Promise
    // identity) don't re-trigger the provider's hydration effect and clobber any
    // post-hydration optimistic state.
    const [pinnedWishlistInitialState] = useState(() => pageData.wishlistInitialState);

    // Pin recommendation promises here (not in CartBody): if pinned downstream, the basket
    // re-suspending would unmount CartBody and lose its useState pinning. Pinning at the route
    // level keeps the rec promise references stable across cart revalidations.
    const [pinnedMayAlsoLikePromise] = useState(() => pageData.cartMayAlsoLikePromise);
    const [pinnedRecentlyViewedPromise] = useState(() => pageData.cartRecentlyViewedPromise);

    // Reserve vertical space for the recommendation carousels while their promises (and the
    // basket itself) are loading. The upper carousel can sit in the initial viewport on small
    // carts (single line item), so a `null` fallback would cause CLS — render the same skeleton
    // shape under the basket-loading skeleton (gate A) and under the rec Suspense fallbacks.
    const mayAlsoLikeTitle = tProduct('recommendations.youMightAlsoLike');
    const recentlyViewedTitle = tProduct('recommendations.recentlyViewed');
    const recommendationsSkeleton = (
        <div className="mt-16 space-y-16">
            <ProductRecommendationSkeleton title={mayAlsoLikeTitle} className="max-w-none px-0" />
            <ProductRecommendationSkeleton title={recentlyViewedTitle} className="max-w-none px-0" />
        </div>
    );
    const recommendationsSlot = (
        <div className="mt-16 space-y-16">
            <DeferredProductRecommendations
                recommenderName={EINSTEIN_RECOMMENDERS.CART_MAY_ALSO_LIKE}
                recommenderTitle={mayAlsoLikeTitle}
                data={pinnedMayAlsoLikePromise}
                className="max-w-none px-0"
                fallback={<ProductRecommendationSkeleton title={mayAlsoLikeTitle} className="max-w-none px-0" />}
            />
            <DeferredProductRecommendations
                recommenderName={EINSTEIN_RECOMMENDERS.CART_RECENTLY_VIEWED}
                recommenderTitle={recentlyViewedTitle}
                data={pinnedRecentlyViewedPromise}
                className="max-w-none px-0"
                fallback={<ProductRecommendationSkeleton title={recentlyViewedTitle} className="max-w-none px-0" />}
            />
        </div>
    );

    return (
        <WishlistProvider initialState={pinnedWishlistInitialState}>
            <SeoMeta
                title={t('meta.title', { defaultValue: 'Cart' })}
                description={t('meta.description', {
                    defaultValue: 'Review the items in your shopping cart and continue to checkout.',
                })}
                openGraph={{ type: 'website', url: pageData.pageUrl }}
            />
            <Suspense
                fallback={
                    <CartSkeleton
                        productItemCount={pageData.basketSnapshot?.uniqueProductCount ?? 0}
                        recommendationsSlot={recommendationsSkeleton}
                    />
                }>
                <Await resolve={pageData.basketDataPromise} errorElement={<CartLoadError />}>
                    {(basketData) => (
                        <Suspense
                            fallback={
                                <CartBody
                                    basketData={basketData}
                                    wishlistProductIds={[]}
                                    recommendationsSlot={recommendationsSlot}
                                />
                            }>
                            <Await
                                resolve={pinnedWishlistPromise}
                                errorElement={
                                    <CartBody
                                        basketData={basketData}
                                        wishlistProductIds={[]}
                                        recommendationsSlot={recommendationsSlot}
                                    />
                                }>
                                {(wishlistProductIds: string[]) => (
                                    <CartBody
                                        basketData={basketData}
                                        wishlistProductIds={wishlistProductIds}
                                        recommendationsSlot={recommendationsSlot}
                                    />
                                )}
                            </Await>
                        </Suspense>
                    )}
                </Await>
            </Suspense>
        </WishlistProvider>
    );
}

/**
 * Renders `CartContent` and, under BOPIS, wraps it in `PickupProvider`. Extracted from
 * the route component so that `CartContent` mounts exactly once across both the BOPIS
 * and stripped-BOPIS code paths.
 */
function CartBody({
    basketData,
    wishlistProductIds,
    recommendationsSlot,
}: {
    basketData: Awaited<CartPageData['basketDataPromise']>;
    wishlistProductIds: string[];
    recommendationsSlot: ReactElement;
}): ReactElement {
    const content = (
        <CartContent
            basket={basketData.basket}
            productsByItemId={basketData.productsByItemId}
            bonusProductsById={basketData.bonusProductsById}
            promotions={basketData.promotions}
            wishlistProductIds={wishlistProductIds}
            recommendationsSlot={recommendationsSlot}
        />
    );

    // Default for stripped BOPIS — reassigned inside the extension block when present.
    let wrappedContent: ReactElement = content;
    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    wrappedContent = (
        <PickupProvider
            basket={basketData.basket}
            initialPickupStores={
                basketData.storesByStoreId && Object.keys(basketData.storesByStoreId).length > 0
                    ? new Map(Object.entries(basketData.storesByStoreId))
                    : undefined
            }>
            {content}
        </PickupProvider>
    );
    // @sfdc-extension-block-end SFDC_EXT_BOPIS

    return wrappedContent;
}
