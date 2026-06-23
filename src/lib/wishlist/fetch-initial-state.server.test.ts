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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NormalizedApiError } from '@/lib/api/normalized-api-error';
import { getAuth } from '@/middlewares/auth.server';
import { getOrCreateWishlist } from '@/lib/api/wishlist.server';
import { fetchWishlistInitialState } from './fetch-initial-state.server';

vi.mock('@/middlewares/auth.server', () => ({ getAuth: vi.fn() }));
vi.mock('@/lib/api/wishlist.server', () => ({ getOrCreateWishlist: vi.fn() }));

describe('fetchWishlistInitialState', () => {
    const mockContext = {} as never;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('returns empty state when session has no customerId without calling getOrCreateWishlist', async () => {
        vi.mocked(getAuth).mockReturnValue({
            userType: 'guest',
            customerId: undefined,
            accessToken: 'tok',
            accessTokenExpiry: Date.now() + 60_000,
        } as never);

        const result = await fetchWishlistInitialState(mockContext);

        expect(result).toEqual({ customerId: null, listId: null, itemsByProductId: new Map() });
        expect(getOrCreateWishlist).not.toHaveBeenCalled();
    });

    test('returns empty state when access token has expired', async () => {
        vi.mocked(getAuth).mockReturnValue({
            userType: 'registered',
            customerId: 'cust-1',
            accessToken: 'tok',
            accessTokenExpiry: Date.now() - 1_000,
        } as never);

        const result = await fetchWishlistInitialState(mockContext);

        expect(result.customerId).toBeNull();
        expect(getOrCreateWishlist).not.toHaveBeenCalled();
    });

    test('fetches the wishlist for guest sessions with a valid customerId (gcid)', async () => {
        vi.mocked(getAuth).mockReturnValue({
            userType: 'guest',
            customerId: 'guest-cust-1',
            accessToken: 'tok',
            accessTokenExpiry: Date.now() + 60_000,
        } as never);
        vi.mocked(getOrCreateWishlist).mockResolvedValue({
            id: 'list-guest-1',
            customerProductListItems: [{ id: 'item-1', productId: 'sku-1' }],
        } as never);

        const result = await fetchWishlistInitialState(mockContext);

        expect(getOrCreateWishlist).toHaveBeenCalledWith(mockContext, 'guest-cust-1');
        expect(result.customerId).toBe('guest-cust-1');
        expect(result.listId).toBe('list-guest-1');
    });

    test('returns full state for registered user with wishlist items', async () => {
        vi.mocked(getAuth).mockReturnValue({
            userType: 'registered',
            customerId: 'cust-1',
            accessToken: 'tok',
            accessTokenExpiry: Date.now() + 60_000,
        } as never);
        vi.mocked(getOrCreateWishlist).mockResolvedValue({
            id: 'list-1',
            customerProductListItems: [
                { id: 'item-1', productId: 'sku-1' },
                { id: 'item-2', productId: 'sku-2' },
                { id: 'item-3', productId: '' }, // Filtered.
                { id: 'item-4' }, // Missing productId — filtered.
            ],
        } as never);

        const result = await fetchWishlistInitialState(mockContext);

        expect(result.customerId).toBe('cust-1');
        expect(result.listId).toBe('list-1');
        expect(Array.from(result.itemsByProductId.entries())).toEqual([
            ['sku-1', { itemId: 'item-1' }],
            ['sku-2', { itemId: 'item-2' }],
        ]);
    });

    test('returns empty state when wishlist exists but has no items', async () => {
        vi.mocked(getAuth).mockReturnValue({
            userType: 'registered',
            customerId: 'cust-1',
            accessToken: 'tok',
            accessTokenExpiry: Date.now() + 60_000,
        } as never);
        vi.mocked(getOrCreateWishlist).mockResolvedValue({
            id: 'list-1',
            customerProductListItems: [],
        } as never);

        const result = await fetchWishlistInitialState(mockContext);

        expect(result.customerId).toBe('cust-1');
        expect(result.listId).toBe('list-1');
        expect(result.itemsByProductId.size).toBe(0);
    });

    test('propagates NormalizedApiError when getOrCreateWishlist rejects', async () => {
        vi.mocked(getAuth).mockReturnValue({
            userType: 'registered',
            customerId: 'cust-1',
            accessToken: 'tok',
            accessTokenExpiry: Date.now() + 60_000,
        } as never);
        const apiErr = new NormalizedApiError(new TypeError('Network failure'));
        vi.mocked(getOrCreateWishlist).mockRejectedValue(apiErr);

        await expect(fetchWishlistInitialState(mockContext)).rejects.toBe(apiErr);
    });
});
