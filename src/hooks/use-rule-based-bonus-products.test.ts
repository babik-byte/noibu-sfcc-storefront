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

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRuleBasedBonusProducts } from './use-rule-based-bonus-products';
import type { ShopperSearch } from '@/scapi';
import { useScapiFetcher } from '@/hooks/use-scapi-fetcher';
import { useConfig } from '@salesforce/storefront-next-runtime/config';

const mockLoad = vi.fn();
const mockFetcher = {
    load: mockLoad,
    state: 'idle',
    data: undefined as ShopperSearch.schemas['ProductSearchResult'] | undefined,
    errors: null,
    success: false,
};

vi.mock('@/hooks/use-scapi-fetcher', () => ({
    useScapiFetcher: vi.fn(() => mockFetcher),
}));

vi.mock('@salesforce/storefront-next-runtime/config', () => ({
    useConfig: vi.fn(() => ({
        search: {
            products: {
                refine: {
                    orderableOnly: true,
                },
            },
        },
    })),
}));

describe('useRuleBasedBonusProducts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoad.mockClear();
        mockFetcher.state = 'idle';
        mockFetcher.data = undefined;
        mockFetcher.errors = null;
        mockFetcher.success = false;
    });

    describe('constructs correct refine parameters', () => {
        it('should build refine array with single promotionId and pmpt=bonus', () => {
            renderHook(() => useRuleBasedBonusProducts(['test-promo-id']));

            expect(vi.mocked(useScapiFetcher)).toHaveBeenCalledWith(
                'shopperSearch',
                'productSearch',
                expect.objectContaining({
                    params: {
                        query: expect.objectContaining({
                            refine: ['orderable_only=true', 'pmid=test-promo-id', 'pmpt=bonus'],
                        }),
                    },
                })
            );
        });

        it('should build refine array with multiple promotionIds and pmpt=bonus', () => {
            renderHook(() => useRuleBasedBonusProducts(['promo-1', 'promo-2', 'promo-3']));

            expect(vi.mocked(useScapiFetcher)).toHaveBeenCalledWith(
                'shopperSearch',
                'productSearch',
                expect.objectContaining({
                    params: {
                        query: expect.objectContaining({
                            refine: [
                                'orderable_only=true',
                                'pmid=promo-1',
                                'pmid=promo-2',
                                'pmid=promo-3',
                                'pmpt=bonus',
                            ],
                        }),
                    },
                })
            );
        });

        it('should build default refine array when promotionIds is null', () => {
            renderHook(() => useRuleBasedBonusProducts(null));

            expect(vi.mocked(useScapiFetcher)).toHaveBeenCalledWith(
                'shopperSearch',
                'productSearch',
                expect.objectContaining({
                    params: {
                        query: expect.objectContaining({
                            refine: ['orderable_only=true'],
                        }),
                    },
                })
            );
        });

        it('should build default refine array when promotionIds is empty array', () => {
            renderHook(() => useRuleBasedBonusProducts([]));

            expect(vi.mocked(useScapiFetcher)).toHaveBeenCalledWith(
                'shopperSearch',
                'productSearch',
                expect.objectContaining({
                    params: {
                        query: expect.objectContaining({
                            refine: ['orderable_only=true'],
                        }),
                    },
                })
            );
        });

        it('should not include orderable_only when config has orderableOnly=false', () => {
            vi.mocked(useConfig).mockReturnValueOnce({
                search: {
                    products: {
                        refine: {
                            orderableOnly: false,
                        },
                    },
                },
            } as any);

            renderHook(() => useRuleBasedBonusProducts(['test-promo-id']));

            expect(vi.mocked(useScapiFetcher)).toHaveBeenCalledWith(
                'shopperSearch',
                'productSearch',
                expect.objectContaining({
                    params: {
                        query: expect.objectContaining({
                            refine: ['pmid=test-promo-id', 'pmpt=bonus'],
                        }),
                    },
                })
            );
        });
    });

    describe('does not fetch when conditions not met', () => {
        it('should not fetch when promotionIds is null', () => {
            renderHook(() => useRuleBasedBonusProducts(null));

            expect(mockLoad).not.toHaveBeenCalled();
        });

        it('should not fetch when promotionIds is empty array', () => {
            renderHook(() => useRuleBasedBonusProducts([]));

            expect(mockLoad).not.toHaveBeenCalled();
        });

        it('should not fetch when enabled is false', () => {
            renderHook(() => useRuleBasedBonusProducts(['test-promo-id'], { enabled: false }));

            expect(mockLoad).not.toHaveBeenCalled();
        });

        it('should not fetch when promotionIds is undefined', () => {
            renderHook(() => useRuleBasedBonusProducts(undefined));

            expect(mockLoad).not.toHaveBeenCalled();
        });
    });

    describe('fetches when enabled and promotionIds provided', () => {
        it('should trigger fetch when both conditions met', () => {
            renderHook(() => useRuleBasedBonusProducts(['test-promo-id'], { enabled: true }));

            expect(mockLoad).toHaveBeenCalledTimes(1);
        });

        it('should trigger fetch with default enabled=true', () => {
            renderHook(() => useRuleBasedBonusProducts(['test-promo-id']));

            expect(mockLoad).toHaveBeenCalledTimes(1);
        });

        it('should trigger fetch with multiple promotionIds', () => {
            renderHook(() => useRuleBasedBonusProducts(['promo-1', 'promo-2', 'promo-3'], { enabled: true }));

            expect(mockLoad).toHaveBeenCalledTimes(1);
        });
    });

    describe('returns products from fetcher data', () => {
        it('should return products and total from fetcher', () => {
            const mockProducts: ShopperSearch.schemas['ProductSearchHit'][] = [
                { productId: 'prod-1', productName: 'Product 1' },
                { productId: 'prod-2', productName: 'Product 2' },
            ];

            mockFetcher.data = {
                hits: mockProducts,
                total: 2,
                query: '',
                limit: 20,
                offset: 0,
                refinements: [],
                searchPhraseSuggestions: { suggestedTerms: [] },
                sortingOptions: [],
            };

            const { result } = renderHook(() => useRuleBasedBonusProducts(['test-promo-id']));

            expect(result.current.products).toEqual(mockProducts);
            expect(result.current.total).toBe(2);
        });

        it('should return empty array when no data', () => {
            mockFetcher.data = undefined;

            const { result } = renderHook(() => useRuleBasedBonusProducts(['test-promo-id']));

            expect(result.current.products).toEqual([]);
            expect(result.current.total).toBe(0);
        });
    });

    describe('handles loading state', () => {
        it('should return loading true when fetcher is loading', () => {
            mockFetcher.state = 'loading';

            const { result } = renderHook(() => useRuleBasedBonusProducts(['test-promo-id']));

            expect(result.current.isLoading).toBe(true);
        });

        it('should return loading false when fetcher is idle', () => {
            mockFetcher.state = 'idle';

            const { result } = renderHook(() => useRuleBasedBonusProducts(['test-promo-id']));

            expect(result.current.isLoading).toBe(false);
        });
    });
});
