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
 * Einstein Recommender Name Constants
 *
 * These constants represent the recommender names configured in Business Manager
 * and can be used when calling the recommendations API.
 *
 * Public adapter-name identifiers — they ship in the client bundle (no `.server.ts`
 * suffix). They contain no secrets.
 *
 * @example
 * ```tsx
 * import { EINSTEIN_RECOMMENDERS } from '@/lib/adapters/engagement/einstein-recommenders';
 *
 * <ProductRecommendations
 *   recommenderName={EINSTEIN_RECOMMENDERS.PDP_MIGHT_ALSO_LIKE}
 *   title="You May Also Like"
 * />
 * ```
 */
export const EINSTEIN_RECOMMENDERS = {
    /** Similar items modal shown when adding product to cart */
    ADD_TO_CART_MODAL: 'pdp-similar-items',
    /** Recently viewed products shown on cart page */
    CART_RECENTLY_VIEWED: 'viewed-recently-einstein',
    /** You may also like products shown on cart page */
    CART_MAY_ALSO_LIKE: 'product-to-product-einstein',
    /** Complete the set recommendations on PDP */
    PDP_COMPLETE_SET: 'complete-the-set',
    /** Similar items recommendations on PDP */
    PDP_MIGHT_ALSO_LIKE: 'pdp-similar-items',
    /** Recently viewed products shown on PDP */
    PDP_RECENTLY_VIEWED: 'viewed-recently-einstein',
    /** Top selling products for empty search results */
    EMPTY_SEARCH_RESULTS_TOP_SELLERS: 'home-top-revenue-for-category',
    /** Most viewed products for empty search results */
    EMPTY_SEARCH_RESULTS_MOST_VIEWED: 'products-in-all-categories',
} as const;

/**
 * Type representing all valid Einstein recommender names
 */
export type EinsteinRecommenderName = (typeof EINSTEIN_RECOMMENDERS)[keyof typeof EINSTEIN_RECOMMENDERS];
