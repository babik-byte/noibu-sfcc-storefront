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
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getTranslation } from '@salesforce/storefront-next-runtime/i18n';
import type { Recommendation } from '@/hooks/recommenders/use-recommenders';
import ProductRecommendations from '@/components/product-recommendations';
import { EINSTEIN_RECOMMENDERS } from '@/lib/adapters/engagement/einstein-recommenders';

const { t } = getTranslation();

// React Router
import { createMemoryRouter, RouterProvider } from 'react-router';

vi.mock('@/hooks/use-scapi-fetcher', () => ({
    useScapiFetcher: vi.fn(() => ({
        load: vi.fn(),
        submit: vi.fn(),
        data: null,
        errors: undefined,
        success: false,
        state: 'idle' as const,
    })),
}));

// useDeferredRenderSequence is consumed transitively by the carousel's image-gallery; stub to `0`
// to preserve the real hook's "no preloads until the first idle frame" contract.
// @sfdc-extension-block-start SFDC_EXT_RATINGS_REVIEWS
vi.mock('@/extensions/ratings-reviews/providers/product-reviews-context', () => ({
    ProductReviewsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useProductReviews: () => ({
        reviewsSummary: null,
        reviewsSummaryLoading: false,
        reviews: [],
        reviewsLoading: false,
        loadReviewsIfNeeded: () => {},
        aiSummary: '',
        addReviewOptimistic: () => {},
        removeReviewOptimistic: () => {},
        expandReviews: () => {},
        registerExpand: () => {},
        registerOnExpanded: () => {},
        triggerOnExpanded: () => {},
    }),
}));
// @sfdc-extension-block-end SFDC_EXT_RATINGS_REVIEWS

vi.mock('@/hooks/use-deferred-render', () => ({
    useDeferredRenderSequence: () => 0,
}));

// Components
import CartContent from './cart-content';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import BasketProvider, { useBasket } from '@/providers/basket';

// Minimum-viable enriched recommendations that ProductCarousel + ProductTile can render.
const buildRecs = (productNames: string[]) =>
    productNames.map((productName, idx) => ({
        id: `rec-${idx + 1}`,
        productId: `rec-${idx + 1}`,
        productName,
        price: 19.99 + idx,
        currency: 'USD',
        imageGroups: [
            {
                viewType: 'medium',
                images: [
                    {
                        alt: productName,
                        link: `https://example.com/${idx + 1}.jpg`,
                        disBaseLink: `https://example.com/${idx + 1}.jpg`,
                    },
                ],
            },
        ],
    }));

// Default empty recommendation promises — server resolved with no recs.
const emptyRecsPromise = (): Promise<Recommendation> => Promise.resolve({});

/**
 * Build a recommendations slot the same way the cart route does — pinning is the route's concern,
 * so tests pass the promises directly to <ProductRecommendations>.
 */
const buildRecommendationsSlot = ({
    cartMayAlsoLikePromise = emptyRecsPromise(),
    cartRecentlyViewedPromise = emptyRecsPromise(),
}: {
    cartMayAlsoLikePromise?: Promise<Recommendation>;
    cartRecentlyViewedPromise?: Promise<Recommendation>;
} = {}) => (
    <div className="mt-16 space-y-16">
        <ProductRecommendations
            recommenderName={EINSTEIN_RECOMMENDERS.CART_MAY_ALSO_LIKE}
            recommenderTitle={t('product:recommendations.youMightAlsoLike')}
            data={cartMayAlsoLikePromise}
            className="max-w-none px-0"
        />
        <ProductRecommendations
            recommenderName={EINSTEIN_RECOMMENDERS.CART_RECENTLY_VIEWED}
            recommenderTitle={t('product:recommendations.recentlyViewed')}
            data={cartRecentlyViewedPromise}
            className="max-w-none px-0"
        />
    </div>
);

// Utils
const renderCartContent = (props: React.ComponentProps<typeof CartContent>) => {
    // Using createMemoryRouter in framework mode is fine
    // because both framework and data routers share the same underlying architecture, so it provides a valid navigation context for hooks and <Link>.
    // Even though it's listed under "data routers," it fully supports testing non-route components that rely on router behavior.
    const router = createMemoryRouter(
        [
            {
                path: '/cart',
                element: (
                    <AllProvidersWrapper>
                        <CartContent {...props} />
                    </AllProvidersWrapper>
                ),
            },
        ],
        { initialEntries: ['/cart'] }
    );

    return render(<RouterProvider router={router} />);
};

describe('CartContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockBasket = {
        basketId: 'test-basket-id',
        productItems: [
            { itemId: 'item-1', quantity: 2, productId: 'product-1' },
            { itemId: 'item-2', quantity: 1, productId: 'product-2' },
        ],
    };

    const mockProductMap = {
        'item-1': { id: 'product-1', name: 'Product 1', variants: [{} as any] },
        'item-2': { id: 'product-2', name: 'Product 2', variants: [{} as any] },
    } as any;

    const mockPromotionMap = {
        'promo-1': { id: 'promo-1', name: 'Promotion 1' },
    };

    const mockBonusProductsById: Record<string, import('@/scapi').ShopperProducts.schemas['Product']> = {};

    test('renders empty cart for 0 product items', () => {
        // Test empty product items array
        const emptyBasket = { ...mockBasket, productItems: [] };
        renderCartContent({
            basket: emptyBasket,
            productsByItemId: mockProductMap,
            bonusProductsById: mockBonusProductsById,
        });

        expect(screen.getByTestId('sf-cart-empty')).toBeInTheDocument();
        expect(screen.getByText(t('cart:empty.title'))).toBeInTheDocument();
        expect(screen.getByText(t('cart:empty.guestMessage'))).toBeInTheDocument();
        expect(screen.getByText(t('cart:empty.continueShopping'))).toBeInTheDocument();
        expect(screen.queryByTestId('sf-cart-container')).not.toBeInTheDocument();
    });

    test('renders empty cart when basket is undefined', () => {
        renderCartContent({
            basket: undefined,
            productsByItemId: mockProductMap,
            bonusProductsById: mockBonusProductsById,
        });

        expect(screen.getByTestId('sf-cart-empty')).toBeInTheDocument();
        expect(screen.getByText(t('cart:empty.title'))).toBeInTheDocument();
    });

    test('renders cart content with proper structure when basket has items', () => {
        renderCartContent({
            basket: mockBasket,
            productsByItemId: mockProductMap,
            bonusProductsById: mockBonusProductsById,
            promotions: mockPromotionMap,
        });

        // Verify main container
        expect(screen.getByTestId('sf-cart-container')).toBeInTheDocument();
        expect(screen.queryByTestId('sf-cart-empty')).not.toBeInTheDocument();

        // Verify page heading with item count is rendered (h1)
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toBeInTheDocument();
        expect(heading).toHaveTextContent(t('cart:itemCount', { count: 3 }));

        // Verify product items are rendered (they have individual test IDs)
        expect(screen.getByTestId('sf-product-item-product-1')).toBeInTheDocument();
        expect(screen.getByTestId('sf-product-item-product-2')).toBeInTheDocument();
    });

    test('handles missing promotionMap prop gracefully', () => {
        renderCartContent({
            basket: mockBasket,
            productsByItemId: mockProductMap,
            bonusProductsById: mockBonusProductsById,
        });

        // Verify that the cart container is still rendered even without promotionMap
        expect(screen.getByTestId('sf-cart-container')).toBeInTheDocument();

        // Verify product items are still rendered
        expect(screen.getByTestId('sf-product-item-product-1')).toBeInTheDocument();
        expect(screen.getByTestId('sf-product-item-product-2')).toBeInTheDocument();
    });

    test('handles basket with missing productItems (undefined) as empty state', () => {
        // productItems is omitted entirely
        const basketWithoutProductItems = { basketId: 'b-no-items' } as any;
        renderCartContent({
            basket: basketWithoutProductItems,
            productsByItemId: {} as any,
            bonusProductsById: mockBonusProductsById,
        });

        // Should render empty state
        expect(screen.getByTestId('sf-cart-empty')).toBeInTheDocument();
    });

    test('renders singular cart heading when total item count is one', () => {
        const oneItemBasket = {
            ...mockBasket,
            productItems: [{ itemId: 'item-1', quantity: 1, productId: 'product-1' }],
        };

        renderCartContent({
            basket: oneItemBasket,
            productsByItemId: mockProductMap,
            bonusProductsById: mockBonusProductsById,
        });

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('cart:itemCount', { count: 1 }));
    });

    describe('Line item secondary actions', () => {
        test('renders remove, edit, and wishlist controls for each cart item with itemId', async () => {
            renderCartContent({
                basket: mockBasket,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
            });

            expect(screen.getByTestId('remove-item-item-1')).toBeInTheDocument();
            expect(screen.getByTestId('remove-item-item-2')).toBeInTheDocument();
            expect(screen.getByTestId('edit-item-item-1')).toBeInTheDocument();
            expect(screen.getByTestId('edit-item-item-2')).toBeInTheDocument();
            expect(await screen.findByTestId('cart-add-wishlist-item-1')).toBeInTheDocument();
            expect(await screen.findByTestId('cart-add-wishlist-item-2')).toBeInTheDocument();
        });

        test('does not render secondary actions when product has no itemId', async () => {
            const basketWithoutItemIds = {
                ...mockBasket,
                productItems: [
                    { quantity: 2, productId: 'product-1' },
                    { itemId: 'item-2', quantity: 1, productId: 'product-2' },
                ],
            };

            renderCartContent({
                basket: basketWithoutItemIds,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
            });

            expect(screen.queryByTestId('remove-item-item-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('edit-item-item-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('cart-add-wishlist-item-1')).not.toBeInTheDocument();
            expect(screen.getByTestId('remove-item-item-2')).toBeInTheDocument();
            expect(screen.getByTestId('edit-item-item-2')).toBeInTheDocument();
            expect(await screen.findByTestId('cart-add-wishlist-item-2')).toBeInTheDocument();
        });

        test('choice-based bonus product hides wishlist and shows remove only', async () => {
            const basket = {
                basketId: 'b1',
                productItems: [
                    {
                        itemId: 'item-1',
                        quantity: 1,
                        productId: 'p1',
                        bonusProductLineItem: true,
                        bonusDiscountLineItemId: 'bonus-discount-choice-1',
                    },
                ],
                bonusDiscountLineItems: [
                    {
                        id: 'bonus-discount-choice-1',
                        promotionId: 'promo-choice-1',
                        maxBonusItems: 3,
                        bonusProducts: [{ productId: 'p1', productName: 'Choice Bonus Product 1' }],
                    },
                ],
            };

            renderCartContent({
                basket: basket as any,
                productsByItemId: { 'item-1': { id: 'p1', variants: [{} as any] } } as any,
                bonusProductsById: { p1: { id: 'p1', name: 'Choice Bonus Product 1' } } as any,
            });

            expect(screen.queryByTestId('edit-item-item-1')).not.toBeInTheDocument();
            expect(screen.getByTestId('remove-item-item-1')).toBeInTheDocument();
            await waitFor(() => {
                expect(screen.queryByTestId('cart-add-wishlist-item-1')).not.toBeInTheDocument();
            });
        });

        test('auto bonus product hides wishlist and does not show edit', () => {
            const basket = {
                basketId: 'b1',
                productItems: [
                    {
                        itemId: 'item-1',
                        quantity: 1,
                        productId: 'p1',
                        bonusProductLineItem: true,
                        bonusDiscountLineItemId: 'bonus-discount-auto-1',
                    },
                ],
                bonusDiscountLineItems: [
                    {
                        id: 'bonus-discount-auto-1',
                        promotionId: 'promo-auto-1',
                        maxBonusItems: 1,
                        // No bonusProducts array = auto bonus
                    },
                ],
            };

            renderCartContent({
                basket: basket as any,
                productsByItemId: { 'item-1': { id: 'p1', variants: [{} as any] } } as any,
                bonusProductsById: mockBonusProductsById,
            });

            expect(screen.queryByTestId('edit-item-item-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('cart-add-wishlist-item-1')).not.toBeInTheDocument();
        });
    });

    describe('Inventory validation and checkout blocking', () => {
        test('disables checkout button when items exceed inventory', () => {
            const basketWithExcessQuantity = {
                basketId: 'test-basket',
                productItems: [
                    {
                        itemId: 'item-1',
                        quantity: 100,
                        productId: 'product-1',
                        shipmentId: 'ship-1',
                        productName: 'Product 1',
                    },
                ],
            };

            const productMapWithLowStock = {
                'item-1': {
                    id: 'product-1',
                    name: 'Product 1',
                    inventory: { id: 'inv-1', ats: 5, orderable: true },
                    variants: [{} as any],
                },
            } as any;

            renderCartContent({
                basket: basketWithExcessQuantity as any,
                productsByItemId: productMapWithLowStock,
                bonusProductsById: {},
            });

            const checkoutButtons = screen.getAllByText(t('cart:checkout.continueToCheckout'));
            // Both mobile and desktop buttons should be disabled
            checkoutButtons.forEach((button) => {
                expect(button.closest('button')).toBeDisabled();
            });
        });

        test('shows inventory error banner when items exceed stock', () => {
            const basketWithExcessQuantity = {
                basketId: 'test-basket',
                productItems: [
                    {
                        itemId: 'item-1',
                        quantity: 100,
                        productId: 'product-1',
                        shipmentId: 'ship-1',
                        productName: 'Product 1',
                    },
                ],
            };

            const productMapWithLowStock = {
                'item-1': {
                    id: 'product-1',
                    name: 'Product 1',
                    inventory: { id: 'inv-1', ats: 5, orderable: true },
                    variants: [{} as any],
                },
            } as any;

            renderCartContent({
                basket: basketWithExcessQuantity as any,
                productsByItemId: productMapWithLowStock,
                bonusProductsById: {},
            });

            const banners = screen.getAllByText(t('cart:inventory.blockMessage'));
            // Should have banners for both mobile and desktop
            expect(banners.length).toBeGreaterThan(0);
            banners.forEach((banner) => {
                expect(banner).toBeInTheDocument();
            });
        });

        test('enables checkout when all items are in stock', () => {
            const basketWithValidQuantity = {
                basketId: 'test-basket',
                productItems: [
                    {
                        itemId: 'item-1',
                        quantity: 3,
                        productId: 'product-1',
                        shipmentId: 'ship-1',
                        productName: 'Product 1',
                    },
                ],
            };

            const productMapWithStock = {
                'item-1': {
                    id: 'product-1',
                    name: 'Product 1',
                    inventory: { id: 'inv-1', ats: 10, orderable: true },
                    variants: [{} as any],
                },
            } as any;

            renderCartContent({
                basket: basketWithValidQuantity as any,
                productsByItemId: productMapWithStock,
                bonusProductsById: {},
            });

            const checkoutLinks = screen.getAllByText(t('cart:checkout.continueToCheckout'));
            // Both mobile and desktop buttons should be enabled links
            checkoutLinks.forEach((link) => {
                expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining('/checkout'));
            });
        });

        test('does not show error banner when all items are in stock', () => {
            const basketWithValidQuantity = {
                basketId: 'test-basket',
                productItems: [
                    {
                        itemId: 'item-1',
                        quantity: 3,
                        productId: 'product-1',
                        shipmentId: 'ship-1',
                        productName: 'Product 1',
                    },
                ],
            };

            const productMapWithStock = {
                'item-1': {
                    id: 'product-1',
                    name: 'Product 1',
                    inventory: { id: 'inv-1', ats: 10, orderable: true },
                    variants: [{} as any],
                },
            } as any;

            renderCartContent({
                basket: basketWithValidQuantity as any,
                productsByItemId: productMapWithStock,
                bonusProductsById: {},
            });

            expect(screen.queryByText(t('cart:inventory.blockMessage'))).not.toBeInTheDocument();
        });
    });

    describe('CartItemEditButton Integration', () => {
        test('renders edit buttons for each cart item', () => {
            renderCartContent({
                basket: mockBasket,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
            });

            expect(screen.getByTestId('edit-item-item-1')).toBeInTheDocument();
            expect(screen.getByTestId('edit-item-item-2')).toBeInTheDocument();

            const editButtons = screen.getAllByText(t('actionCard:edit'));
            expect(editButtons).toHaveLength(2);
        });

        test('applies correct className to edit buttons', () => {
            renderCartContent({
                basket: mockBasket,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
            });

            const editButton1 = screen.getByTestId('edit-item-item-1');
            const editButton2 = screen.getByTestId('edit-item-item-2');

            expect(editButton1).toHaveClass('pl-0');
            expect(editButton2).toHaveClass('pl-0');
        });

        test('opens product modal when edit button is clicked', () => {
            renderCartContent({
                basket: mockBasket,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
            });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            const editButton = screen.getByTestId('edit-item-item-1');
            fireEvent.click(editButton);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText(t('editItem:title'))).toBeInTheDocument();
        });

        test('can close modal using close button', () => {
            renderCartContent({
                basket: mockBasket,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
            });

            const editButton = screen.getByTestId('edit-item-item-1');
            fireEvent.click(editButton);

            expect(screen.getByRole('dialog')).toBeInTheDocument();

            const closeButton = screen.getByRole('button', { name: /close/i });
            fireEvent.click(closeButton);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        test('does not render edit buttons when product has no itemId', () => {
            const basketWithoutItemIds = {
                ...mockBasket,
                productItems: [
                    { quantity: 2, productId: 'product-1' },
                    { itemId: 'item-2', quantity: 1, productId: 'product-2' },
                ],
            };

            renderCartContent({
                basket: basketWithoutItemIds,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
            });

            expect(screen.queryByTestId('edit-item-item-1')).not.toBeInTheDocument();
            expect(screen.getByTestId('edit-item-item-2')).toBeInTheDocument();
        });
    });

    describe('Cart recommendations section', () => {
        // CartContent renders the recommendations region from a `recommendationsSlot` ReactNode
        // owned by the route. These tests construct the slot the same way `CartBody` does so
        // they verify both the slot integration and that <ProductRecommendations data={…}>
        // resolves the loader-provided promises end-to-end.
        test('renders the "you might also like" carousel with translated title and recommended products', async () => {
            renderCartContent({
                basket: mockBasket,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
                recommendationsSlot: buildRecommendationsSlot({
                    cartMayAlsoLikePromise: Promise.resolve({
                        recommenderName: 'product-to-product-einstein',
                        recs: buildRecs(['Recommended Shirt', 'Recommended Pants']),
                    }),
                }),
            });

            expect(await screen.findByText(t('product:recommendations.youMightAlsoLike'))).toBeInTheDocument();
            expect(screen.getByText('Recommended Shirt')).toBeInTheDocument();
            expect(screen.getByText('Recommended Pants')).toBeInTheDocument();
        });

        test('renders the "recently viewed" carousel with its translated title and product', async () => {
            renderCartContent({
                basket: mockBasket,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
                recommendationsSlot: buildRecommendationsSlot({
                    cartRecentlyViewedPromise: Promise.resolve({
                        recommenderName: 'viewed-recently-einstein',
                        recs: buildRecs(['Previously Viewed Hat']),
                    }),
                }),
            });

            expect(await screen.findByText(t('product:recommendations.recentlyViewed'))).toBeInTheDocument();
            expect(screen.getByText('Previously Viewed Hat')).toBeInTheDocument();
        });

        test('renders nothing for either recommender when the resolved recs arrays are empty', async () => {
            renderCartContent({
                basket: mockBasket,
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
                recommendationsSlot: buildRecommendationsSlot(),
            });

            // Allow Suspense boundaries to resolve their (empty) promises.
            await waitFor(() => {
                expect(screen.getByTestId('sf-cart-container')).toBeInTheDocument();
            });
            expect(screen.queryByText(t('product:recommendations.youMightAlsoLike'))).not.toBeInTheDocument();
            expect(screen.queryByText(t('product:recommendations.recentlyViewed'))).not.toBeInTheDocument();
        });

        test('renders nothing for either recommender when the cart is empty', async () => {
            // Empty cart short-circuits to <CartEmpty />; the recommendations region never renders.
            renderCartContent({
                basket: { ...mockBasket, productItems: [] },
                productsByItemId: mockProductMap,
                bonusProductsById: mockBonusProductsById,
                // The slot is still passed (the route always builds it) — we just confirm
                // CartContent doesn't render anything below CartEmpty.
                recommendationsSlot: buildRecommendationsSlot(),
            });

            await waitFor(() => {
                expect(screen.getByTestId('sf-cart-empty')).toBeInTheDocument();
            });
            expect(screen.queryByText(t('product:recommendations.youMightAlsoLike'))).not.toBeInTheDocument();
            expect(screen.queryByText(t('product:recommendations.recentlyViewed'))).not.toBeInTheDocument();
        });
    });

    describe('Edit button visibility (CartItemEditButton presence)', () => {
        function renderWith(productsByItemId: Record<string, any>) {
            const basket = {
                basketId: 'b1',
                productItems: [{ itemId: 'item-1', quantity: 1, productId: 'p1' }],
            };
            return renderCartContent({ basket, productsByItemId, bonusProductsById: mockBonusProductsById });
        }

        const editBtn = () => screen.queryByTestId('edit-item-item-1');

        test('standard product does not show CartItemEditButton', () => {
            renderWith({ 'item-1': { id: 'p1', type: { item: true } } } as any);
            expect(editBtn()).not.toBeInTheDocument();
        });

        test('product with variants shows CartItemEditButton', () => {
            renderWith({ 'item-1': { id: 'p1', variants: [{} as any] } } as any);
            expect(editBtn()).toBeInTheDocument();
        });

        test('missing product details mapping shows CartItemEditButton', () => {
            const basket = { basketId: 'b1', productItems: [{ itemId: 'item-1', quantity: 1, productId: 'p1' }] };
            renderCartContent({
                basket,
                productsByItemId: {} as any,
                bonusProductsById: mockBonusProductsById,
            });
            expect(editBtn()).toBeInTheDocument();
        });

        test('bundle product shows CartItemEditButton', () => {
            renderWith({ 'item-1': { id: 'p1', type: { bundle: true } } } as any);
            expect(editBtn()).toBeInTheDocument();
        });

        test('parent product shows CartItemEditButton', () => {
            renderWith({ 'item-1': { id: 'p1', type: { master: true } } } as any);
            expect(editBtn()).toBeInTheDocument();
        });

        test('choice-based bonus product does not show CartItemEditButton', () => {
            const basket = {
                basketId: 'b1',
                productItems: [
                    {
                        itemId: 'item-1',
                        quantity: 1,
                        productId: 'p1',
                        bonusProductLineItem: true,
                        bonusDiscountLineItemId: 'bonus-discount-choice-1',
                    },
                ],
                bonusDiscountLineItems: [
                    {
                        id: 'bonus-discount-choice-1',
                        promotionId: 'promo-choice-1',
                        maxBonusItems: 3,
                        bonusProducts: [{ productId: 'p1', productName: 'Choice Bonus Product 1' }],
                    },
                ],
            };

            renderCartContent({
                basket: basket as any,
                productsByItemId: { 'item-1': { id: 'p1', variants: [{} as any] } } as any,
                bonusProductsById: { p1: { id: 'p1', name: 'Choice Bonus Product 1' } } as any,
            });

            expect(editBtn()).not.toBeInTheDocument();
            expect(screen.getByTestId('remove-item-item-1')).toBeInTheDocument();
        });

        test('auto bonus product does not show CartItemEditButton', () => {
            const basket = {
                basketId: 'b1',
                productItems: [
                    {
                        itemId: 'item-1',
                        quantity: 1,
                        productId: 'p1',
                        bonusProductLineItem: true,
                        bonusDiscountLineItemId: 'bonus-discount-auto-1',
                    },
                ],
                bonusDiscountLineItems: [
                    {
                        id: 'bonus-discount-auto-1',
                        promotionId: 'promo-auto-1',
                        maxBonusItems: 1,
                    },
                ],
            };

            renderCartContent({
                basket: basket as any,
                productsByItemId: { 'item-1': { id: 'p1', variants: [{} as any] } } as any,
                bonusProductsById: mockBonusProductsById,
            });

            expect(editBtn()).not.toBeInTheDocument();
        });
    });

    describe('basket sync into BasketProvider', () => {
        // Read-only consumer: useBasket() does not fall back to a SCAPI fetch. If CartContent's
        // pre-paint sync is broken, the probe renders "no-basket" on first commit and never recovers.
        function BasketProbe() {
            const basket = useBasket();
            return <div data-testid="basket-probe">{basket?.basketId ?? 'no-basket'}</div>;
        }

        const renderWithBasketProvider = (
            basket: typeof mockBasket,
            ProbeComponent: React.ComponentType = BasketProbe
        ) => {
            const router = createMemoryRouter(
                [
                    {
                        path: '/cart',
                        element: (
                            <AllProvidersWrapper>
                                <BasketProvider snapshot={null}>
                                    <ProbeComponent />
                                    <CartContent
                                        basket={basket}
                                        productsByItemId={mockProductMap}
                                        bonusProductsById={mockBonusProductsById}
                                        recommendationsSlot={buildRecommendationsSlot()}
                                    />
                                </BasketProvider>
                            </AllProvidersWrapper>
                        ),
                    },
                ],
                { initialEntries: ['/cart'] }
            );
            return render(<RouterProvider router={router} />);
        };

        test('makes the loader basket observable to descendants on first commit', async () => {
            renderWithBasketProvider(mockBasket);

            await waitFor(() => {
                expect(screen.getByTestId('basket-probe')).toHaveTextContent('test-basket-id');
            });
        });

        test('sibling consumer observes undefined on first commit even with the pre-paint sync', async () => {
            // Load-bearing reason useBasket() defaults to autoLoad:false: CartContent's
            // useLayoutEffect-based sync runs *after* the first commit of any consumer that
            // mounts in the same render. Sibling and descendant useBasket() consumers
            // therefore observe `current === undefined` on their first committed render and
            // re-render once the sync writes to context. Auto-load on this site would issue
            // a redundant `GET /baskets/{id}` and flicker the UI before the pre-paint sync
            // takes effect.
            const renders: (string | undefined)[] = [];
            function DefaultProbe() {
                const basket = useBasket();
                renders.push(basket?.basketId);
                return <div data-testid="default-probe">{basket?.basketId ?? 'no-basket'}</div>;
            }

            renderWithBasketProvider(mockBasket, DefaultProbe);

            await waitFor(() => {
                expect(screen.getByTestId('default-probe')).toHaveTextContent('test-basket-id');
            });

            // First committed render does NOT see the basket — the autoLoad:false default is
            // required at every read-only consumer that mounts inside or alongside CartContent.
            expect(renders[0]).toBeUndefined();
        });
    });
});
