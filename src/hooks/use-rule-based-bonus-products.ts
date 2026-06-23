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

import { useMemo, useEffect } from 'react';
import type { ShopperSearch } from '@/scapi';
import { useScapiFetcher } from '@/hooks/use-scapi-fetcher';
import { useConfig } from '@salesforce/storefront-next-runtime/config';

const DEFAULT_BONUS_PRODUCT_SEARCH_PARAMS = { limit: 25, offset: 0 };

/**
 * Hook to fetch rule-based bonus products using ShopperSearch productSearch endpoint.
 * Uses refine parameters: pmid=${promotionId} (for each promotion) and pmpt=bonus
 *
 * @param promotionIds - Array of promotion IDs to fetch bonus products for
 * @param options - Additional options
 * @param options.enabled - Whether to fetch products (default: true)
 * @param options.limit - Maximum number of products to return (default: 25)
 * @param options.offset - Offset for pagination (default: 0)
 * @returns Object with products array, total count, and loading state
 */
export function useRuleBasedBonusProducts(
    promotionIds: string[] | undefined | null,
    options: { enabled?: boolean; limit?: number; offset?: number } = {}
) {
    const { enabled = true, limit, offset } = options;

    const appConfig = useConfig();
    const parameters = useMemo(() => {
        // Build refine array with all promotion IDs and the bonus product type filter
        const refine = [
            ...(appConfig.search.products.refine?.orderableOnly === true ? ['orderable_only=true'] : []),
            ...(Array.isArray(promotionIds) && promotionIds.length
                ? [...promotionIds.map((id) => `pmid=${id}`), 'pmpt=bonus']
                : []),
        ];
        return {
            params: {
                query: {
                    refine: refine as unknown as string,
                    limit: limit || DEFAULT_BONUS_PRODUCT_SEARCH_PARAMS.limit,
                    offset: offset || DEFAULT_BONUS_PRODUCT_SEARCH_PARAMS.offset,
                },
            },
        };
    }, [appConfig, promotionIds, limit, offset]);

    const fetcher = useScapiFetcher('shopperSearch', 'productSearch', parameters);

    // Trigger fetch when enabled and promotionIds change
    // This is the standard pattern - matches useBulkChildProductInventory
    const promotionIdsKey = promotionIds ? JSON.stringify(promotionIds) : '';

    useEffect(() => {
        if (enabled && promotionIds && promotionIds.length > 0) {
            void fetcher.load();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, promotionIdsKey]);

    return {
        products:
            ((fetcher.data as unknown as ShopperSearch.schemas['ProductSearchResult'])?.hits as
                | ShopperSearch.schemas['ProductSearchHit'][]
                | undefined) || [],
        total: (fetcher.data as unknown as ShopperSearch.schemas['ProductSearchResult'])?.total || 0,
        isLoading: fetcher.state === 'loading',
        error: fetcher.errors,
    };
}
