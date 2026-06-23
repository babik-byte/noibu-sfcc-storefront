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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { resourceRoutes } from '@/route-paths';
import { useMiniCartData, useMiniCartDataLoader } from './use-mini-cart-data';
import type { ShopperBasketsV2, ShopperProducts } from '@/scapi';
import { findImageGroupBy } from '@/lib/product/image-groups-utils';

type FetcherData = {
    basket: ShopperBasketsV2.schemas['Basket'] | null;
    productsById: Record<string, ShopperProducts.schemas['Product']>;
} | null;

// Mock React Router's useFetcher
const mockFetcher = {
    state: 'idle' as 'idle' | 'loading' | 'submitting',
    data: null as FetcherData,
    load: vi.fn(),
};

vi.mock('react-router', () => ({
    href: (path: string) => path,
    useFetcher: vi.fn(() => mockFetcher),
}));

// Mock image group utility
vi.mock('@/lib/product/image-groups-utils', () => ({
    findImageGroupBy: vi.fn(() => ({
        viewType: 'small',
        images: [{ link: 'https://example.com/small.jpg', alt: 'Small image' }],
    })),
}));

const mockedFindImageGroupBy = vi.mocked(findImageGroupBy);

const mockUpdateBasket = vi.fn();
const mockSnapshot = {
    basketId: 'basket-123' as string | undefined,
    totalItemCount: 1 as number,
};
vi.mock('@/providers/basket', () => ({
    useBasketUpdater: () => mockUpdateBasket,
    useBasketSnapshot: () =>
        mockSnapshot.basketId
            ? { basketId: mockSnapshot.basketId, totalItemCount: mockSnapshot.totalItemCount, uniqueProductCount: 1 }
            : null,
}));

describe('useMiniCartData', () => {
    const mockBasket: ShopperBasketsV2.schemas['Basket'] = {
        basketId: 'basket-123',
        productItems: [
            {
                itemId: 'item-1',
                productId: 'product-1',
                productName: 'Test Product 1',
                quantity: 2,
                price: 50,
                priceAfterItemDiscount: 45,
                variationValues: { color: 'red', size: 'M' },
            },
            {
                itemId: 'item-2',
                productId: 'product-2',
                productName: 'Test Product 2',
                quantity: 1,
                price: 100,
                priceAfterItemDiscount: 100,
            },
        ],
    };

    const mockProductsData: Record<string, ShopperProducts.schemas['Product']> = {
        'product-1': {
            id: 'product-1',
            name: 'Full Product 1',
            imageGroups: [
                {
                    viewType: 'large',
                    images: [{ link: 'https://example.com/large1.jpg', alt: 'Large image 1' }],
                },
            ],
            variationAttributes: [
                { id: 'color', name: 'Color', values: [{ value: 'red', name: 'Red' }] },
                { id: 'size', name: 'Size', values: [{ value: 'M', name: 'Medium' }] },
            ],
        },
        'product-2': {
            id: 'product-2',
            name: 'Full Product 2',
            imageGroups: [
                {
                    viewType: 'large',
                    images: [{ link: 'https://example.com/large2.jpg', alt: 'Large image 2' }],
                },
            ],
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetcher.state = 'idle';
        mockFetcher.data = null;
        mockFetcher.load.mockReturnValue(Promise.resolve());
        mockSnapshot.basketId = 'basket-123';
        mockSnapshot.totalItemCount = 1;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns loading state on cold open before the fetcher resolves', () => {
        // Regression guard: the hook must not surface a "no basket" snapshot while the resource route
        // is still in flight on first mount. Otherwise a cold open (touch device, external
        // setMiniCartOpen(true), no prefetch) flashes the empty-cart panel for one frame. The hook
        // must report isLoading=true whenever fetcherData has not yet resolved, so the cart sheet
        // panel renders the loading state instead of empty.
        const { result } = renderHook(() => useMiniCartData());

        expect(result.current.basket).toBeNull();
        expect(result.current.productItems).toEqual([]);
        expect(result.current.productsById).toEqual({});
        expect(result.current.isLoading).toBe(true);
        expect(result.current.error).toBeNull();
        expect(mockFetcher.load).toHaveBeenCalledWith(resourceRoutes.basketProducts);
    });

    describe('when no basketId is in the snapshot', () => {
        beforeEach(() => {
            mockSnapshot.basketId = undefined;
        });

        it('does not dispatch a fetch', () => {
            // Regression guard: a fresh visitor with no __sfdc_basket cookie has no basket to enrich.
            // The cart sheet may still mount (e.g. via an externally-driven setMiniCartOpen(true)),
            // and must render an empty-cart state without forcing a SCAPI round-trip. The loader
            // also passes ensureBasket: false; this gate is the call-site half of the same defense.
            renderHook(() => useMiniCartData());

            expect(mockFetcher.load).not.toHaveBeenCalled();
        });

        it('reports isLoading=false so the panel renders the empty state instead of a permanent spinner', () => {
            const { result } = renderHook(() => useMiniCartData());

            expect(result.current.isLoading).toBe(false);
            expect(result.current.basket).toBeNull();
            expect(result.current.productItems).toEqual([]);
        });
    });

    describe('when the snapshot reports an empty basket', () => {
        beforeEach(() => {
            mockSnapshot.basketId = 'basket-123';
            mockSnapshot.totalItemCount = 0;
        });

        it('does not dispatch a fetch', () => {
            // The cookie-derived snapshot is the source of truth for "is the cart empty". When it says
            // zero items there is nothing to enrich — opening the cart sheet (or hover-prefetch) must
            // not round-trip to SCAPI. Cookie-vs-server divergence is documented in the hook; the next
            // route loader reconciles via the basket middleware.
            renderHook(() => useMiniCartData());

            expect(mockFetcher.load).not.toHaveBeenCalled();
        });

        it('reports isLoading=false so the panel renders the empty state instead of a permanent spinner', () => {
            const { result } = renderHook(() => useMiniCartData());

            expect(result.current.isLoading).toBe(false);
            expect(result.current.basket).toBeNull();
            expect(result.current.productItems).toEqual([]);
        });

        it('dispatches a fetch when totalItemCount transitions 0 → N (add-to-cart from empty)', () => {
            // After an add-to-cart from an empty cart the cookie flips totalItemCount 0 → 1. The effect
            // must observe the new value via the snapshot dep and fire its first load — otherwise the
            // mini-cart never picks up the newly added item.
            const { rerender } = renderHook(() => useMiniCartData());

            expect(mockFetcher.load).not.toHaveBeenCalled();

            mockSnapshot.totalItemCount = 1;
            rerender();

            expect(mockFetcher.load).toHaveBeenCalledWith(resourceRoutes.basketProducts);
        });
    });

    it('returns empty productItems when the loaded basket has no items', () => {
        mockFetcher.data = { basket: { basketId: 'basket-123', productItems: [] }, productsById: {} };

        const { result } = renderHook(() => useMiniCartData());

        expect(result.current.basket).toEqual({ basketId: 'basket-123', productItems: [] });
        expect(result.current.productItems).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });

    it('returns loading state when the fetcher is loading', () => {
        mockFetcher.state = 'loading';

        const { result } = renderHook(() => useMiniCartData());

        expect(result.current.isLoading).toBe(true);
    });

    it('merges basket items with product data', async () => {
        mockFetcher.data = { basket: mockBasket, productsById: mockProductsData };

        const { result } = renderHook(() => useMiniCartData());

        await waitFor(() => {
            expect(result.current.productItems.length).toBe(2);
        });

        const firstItem = result.current.productItems[0];
        expect(firstItem.itemId).toBe('item-1');
        expect(firstItem.quantity).toBe(2);
        expect(firstItem.price).toBe(50);
        expect(firstItem.variationAttributes).toBeDefined();
        expect(result.current.productsById).toBe(mockProductsData);
    });

    it('preserves basket-specific data when merging', async () => {
        mockFetcher.data = { basket: mockBasket, productsById: mockProductsData };

        const { result } = renderHook(() => useMiniCartData());

        await waitFor(() => {
            expect(result.current.productItems.length).toBe(2);
        });

        const firstItem = result.current.productItems[0];
        expect(firstItem.itemId).toBe('item-1');
        expect(firstItem.quantity).toBe(2);
        expect(firstItem.price).toBe(50);
        expect(firstItem.priceAfterItemDiscount).toBe(45);
    });

    it('returns basic items when product data is missing for some products', async () => {
        // Only product-1 has data — hook waits for all to be present before enriching.
        mockFetcher.data = {
            basket: mockBasket,
            productsById: { 'product-1': mockProductsData['product-1'] },
        };

        const { result } = renderHook(() => useMiniCartData());

        await waitFor(() => {
            expect(result.current.productItems.length).toBe(2);
        });

        // Both items remain basic until all product data is available.
        expect(result.current.productItems[0].itemId).toBe('item-1');
        expect(result.current.productItems[0].variationAttributes).toBeUndefined();
        expect(result.current.productItems[1].itemId).toBe('item-2');
        expect(result.current.productItems[1].productName).toBe('Test Product 2');
    });

    it('does not trigger a fetch when the fetcher already has data', () => {
        mockFetcher.data = { basket: mockBasket, productsById: mockProductsData };

        renderHook(() => useMiniCartData());

        expect(mockFetcher.load).not.toHaveBeenCalled();
    });

    it('derives variation values from single-value variation attributes when basket variation values are missing', async () => {
        const basketWithoutVariationValues: ShopperBasketsV2.schemas['Basket'] = {
            basketId: 'basket-123',
            productItems: [
                {
                    itemId: 'item-1',
                    productId: 'product-1',
                    productName: 'Test Product 1',
                    quantity: 1,
                    price: 50,
                },
            ],
        };
        mockFetcher.data = {
            basket: basketWithoutVariationValues,
            productsById: {
                'product-1': {
                    ...mockProductsData['product-1'],
                    variationValues: undefined,
                    variationAttributes: [
                        { id: 'color', name: 'Color', values: [{ value: 'yellow', name: 'Yellow' }] },
                    ],
                },
            },
        };

        const { result } = renderHook(() => useMiniCartData());

        await waitFor(() => {
            expect(result.current.productItems.length).toBe(1);
        });

        expect(mockedFindImageGroupBy).not.toHaveBeenCalled();
        expect(result.current.productItems[0].variationValues).toEqual({ color: 'yellow' });
    });

    it('uses variation image matching when explicit variation values exist', async () => {
        mockFetcher.data = { basket: mockBasket, productsById: mockProductsData };

        renderHook(() => useMiniCartData());

        await waitFor(() => {
            expect(mockedFindImageGroupBy).toHaveBeenCalledWith(expect.any(Array), {
                viewType: 'small',
                selectedVariationAttributes: { color: 'red', size: 'M' },
            });
        });
    });

    describe('publishes basket into BasketProvider', () => {
        it('writes the fetched basket via useBasketUpdater on data arrival', () => {
            mockFetcher.data = { basket: mockBasket, productsById: mockProductsData };

            renderHook(() => useMiniCartData());

            expect(mockUpdateBasket).toHaveBeenCalledWith(mockBasket);
        });

        it('does not write when fetcher data is null', () => {
            mockFetcher.data = null;

            renderHook(() => useMiniCartData());

            expect(mockUpdateBasket).not.toHaveBeenCalled();
        });

        it('does not write when fetched basket has no basketId', () => {
            mockFetcher.data = { basket: null, productsById: {} };

            renderHook(() => useMiniCartData());

            expect(mockUpdateBasket).not.toHaveBeenCalled();
        });

        it('does not re-fire on re-render with stable fetcherData reference', () => {
            // Cycle insurance: dep array is [basketId, lastModified, updateBasket]; updateBasket is
            // reference-stable, the id/lastModified pair is value-stable. A regression here would
            // cause an infinite render loop the moment BasketProvider's context update re-rendered
            // the hook.
            mockFetcher.data = { basket: mockBasket, productsById: mockProductsData };

            const { rerender } = renderHook(() => useMiniCartData());
            rerender();
            rerender();

            expect(mockUpdateBasket).toHaveBeenCalledTimes(1);
        });

        it('does not re-fire when a revalidation returns a fresh data object with identical lastModified', () => {
            // Regression guard: fetcher.data flips to a new object reference on every revalidation,
            // even when SCAPI returns an unchanged basket. Without keying the publisher effect on
            // `basketId + lastModified`, every harmless revalidation would re-publish into context
            // and fan out renders across every useBasket() consumer (PDP, PLP, checkout, header).
            const basketWithLastModified = { ...mockBasket, lastModified: '2026-05-17T12:00:00.000Z' };
            mockFetcher.data = { basket: basketWithLastModified, productsById: mockProductsData };

            const { rerender } = renderHook(() => useMiniCartData());

            // Simulate a revalidation that returned an identical basket: new top-level object,
            // new productsById object, but same basketId + lastModified.
            mockFetcher.data = {
                basket: { ...basketWithLastModified },
                productsById: { ...mockProductsData },
            };
            rerender();

            expect(mockUpdateBasket).toHaveBeenCalledTimes(1);
        });

        it('re-fires when lastModified changes', () => {
            const basketA = { ...mockBasket, lastModified: '2026-05-17T12:00:00.000Z' };
            mockFetcher.data = { basket: basketA, productsById: mockProductsData };

            const { rerender } = renderHook(() => useMiniCartData());

            const basketB = { ...mockBasket, lastModified: '2026-05-17T12:00:01.000Z' };
            mockFetcher.data = { basket: basketB, productsById: mockProductsData };
            rerender();

            expect(mockUpdateBasket).toHaveBeenCalledTimes(2);
            expect(mockUpdateBasket).toHaveBeenLastCalledWith(basketB);
        });
    });
});

describe('useMiniCartDataLoader', () => {
    beforeEach(() => {
        mockFetcher.state = 'idle';
        mockFetcher.data = null;
        mockFetcher.load.mockReset();
        mockSnapshot.basketId = 'basket-123';
        mockSnapshot.totalItemCount = 1;
    });

    it('loads the basket-products resource when called', () => {
        const { result } = renderHook(() => useMiniCartDataLoader());

        act(() => {
            result.current();
        });

        expect(mockFetcher.load).toHaveBeenCalledWith(resourceRoutes.basketProducts);
    });

    it('skips dispatch when fetcher is in flight', () => {
        mockFetcher.state = 'loading';

        const { result } = renderHook(() => useMiniCartDataLoader());

        act(() => {
            result.current();
        });

        expect(mockFetcher.load).not.toHaveBeenCalled();
    });

    it('skips dispatch when fetcher already has data', () => {
        mockFetcher.data = { basket: null, productsById: {} };

        const { result } = renderHook(() => useMiniCartDataLoader());

        act(() => {
            result.current();
        });

        expect(mockFetcher.load).not.toHaveBeenCalled();
    });

    it('skips dispatch when no basketId is in the snapshot', () => {
        mockSnapshot.basketId = undefined;

        const { result } = renderHook(() => useMiniCartDataLoader());

        act(() => {
            result.current();
        });

        expect(mockFetcher.load).not.toHaveBeenCalled();
    });

    it('skips dispatch when the snapshot reports an empty basket', () => {
        // A hover-prefetch on an empty cart should not round-trip — the cookie already tells us there
        // are no items to enrich. Mirrors the call-site gate in useMiniCartData.
        mockSnapshot.totalItemCount = 0;

        const { result } = renderHook(() => useMiniCartDataLoader());

        act(() => {
            result.current();
        });

        expect(mockFetcher.load).not.toHaveBeenCalled();
    });

    it('returns a reference-stable callback across renders', () => {
        // Regression guard: like useBasketLoader, this callback ends up wired into
        // the cart-badge prefetch and downstream useEffect dep arrays. The ref-mirror pattern keeps
        // identity stable; this test fails if a future refactor reintroduces fetcher-keyed deps.
        const { result, rerender } = renderHook(() => useMiniCartDataLoader());

        const first = result.current;
        rerender();
        rerender();
        expect(result.current).toBe(first);
    });
});
