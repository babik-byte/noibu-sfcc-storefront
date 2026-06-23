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
import { ApiError } from '@/scapi';
import { NormalizedApiError } from './normalized-api-error';
import { fetchProductById, fetchProductsByIds } from './products.server';

const mockGetProduct = vi.fn();
const mockGetProducts = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/api-clients.server', () => ({
    createApiClients: vi.fn(() => ({
        shopperProducts: {
            getProduct: mockGetProduct,
            getProducts: mockGetProducts,
        },
    })),
}));

vi.mock('@/lib/logger.server', () => ({
    getLogger: vi.fn(() => ({
        error: mockLoggerError,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    })),
}));

describe('fetchProductById', () => {
    const mockContext = {} as any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLoggerError.mockClear();
    });

    test('returns null for empty string', async () => {
        const result = await fetchProductById(mockContext, '');
        expect(result).toBeNull();
        expect(mockGetProduct).not.toHaveBeenCalled();
    });

    test('returns null for whitespace-only string', async () => {
        const result = await fetchProductById(mockContext, '   ');
        expect(result).toBeNull();
        expect(mockGetProduct).not.toHaveBeenCalled();
    });

    test('trims product ID before API call', async () => {
        mockGetProduct.mockResolvedValue({ data: { id: 'sku-123' } });

        await fetchProductById(mockContext, '  sku-123  ', { allImages: true });

        expect(mockGetProduct).toHaveBeenCalledWith({
            params: {
                path: { id: 'sku-123' },
                query: { allImages: true },
            },
        });
    });

    test('returns product data when found', async () => {
        const mockProduct = { id: 'sku-123', name: 'Test Product' };
        mockGetProduct.mockResolvedValue({ data: mockProduct });

        const result = await fetchProductById(mockContext, 'sku-123');

        expect(result).toEqual(mockProduct);
    });

    test('returns null when API returns no data', async () => {
        mockGetProduct.mockResolvedValue({});

        const result = await fetchProductById(mockContext, 'sku-123');

        expect(result).toBeNull();
    });

    test('throws NormalizedApiError for 404 (caller must handle)', async () => {
        const error404 = new ApiError({
            status: 404,
            statusText: 'Not Found',
            headers: new Headers(),
            body: { type: 'Not Found', title: 'Product Not Found', detail: 'Product not found' },
            rawBody: JSON.stringify({ detail: 'Product not found' }),
            url: 'https://api.example.com/products/missing',
            method: 'GET',
        });
        mockGetProduct.mockRejectedValue(error404);

        await expect(fetchProductById(mockContext, 'missing')).rejects.toThrow(NormalizedApiError);
        await expect(fetchProductById(mockContext, 'missing')).rejects.toThrow('Product not found');
    });

    test('throws NormalizedApiError for auth failures (caller must handle)', async () => {
        const error401 = new ApiError({
            status: 401,
            statusText: 'Unauthorized',
            headers: new Headers(),
            body: { type: 'Unauthorized', title: 'Unauthorized', detail: 'Invalid credentials' },
            rawBody: JSON.stringify({ detail: 'Invalid credentials' }),
            url: 'https://api.example.com/products/sku-123',
            method: 'GET',
        });
        mockGetProduct.mockRejectedValue(error401);

        await expect(fetchProductById(mockContext, 'sku-123')).rejects.toThrow(NormalizedApiError);
        await expect(fetchProductById(mockContext, 'sku-123')).rejects.toMatchObject({ status: 401 });
    });

    test('throws NormalizedApiError when API call fails with non-API error', async () => {
        mockGetProduct.mockRejectedValue(new TypeError('Network failure'));

        await expect(fetchProductById(mockContext, 'sku-123')).rejects.toThrow(NormalizedApiError);
        await expect(fetchProductById(mockContext, 'sku-123')).rejects.toThrow('Network failure');
    });

    test('logs operation context when API call fails', async () => {
        const error500 = new ApiError({
            status: 500,
            statusText: 'Internal Server Error',
            headers: new Headers(),
            body: { type: 'Server Error', title: 'Server Error', detail: 'Server error' },
            rawBody: JSON.stringify({ detail: 'Server error' }),
            url: 'https://api.example.com/products/sku-failed',
            method: 'GET',
        });
        mockGetProduct.mockRejectedValue(error500);

        await fetchProductById(mockContext, 'sku-failed', { allImages: true }).catch(() => {});

        expect(mockLoggerError).toHaveBeenCalledWith(
            'shopperProducts.getProduct failed',
            expect.objectContaining({ productId: 'sku-failed' })
        );
    });
});

describe('fetchProductsByIds', () => {
    const mockContext = {} as any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLoggerError.mockClear();
    });

    test('returns empty array for empty input', async () => {
        const result = await fetchProductsByIds(mockContext, []);
        expect(result).toEqual([]);
        expect(mockGetProducts).not.toHaveBeenCalled();
    });

    test('filters out empty and whitespace-only IDs', async () => {
        const result = await fetchProductsByIds(mockContext, ['', '  ', '   ']);
        expect(result).toEqual([]);
        expect(mockGetProducts).not.toHaveBeenCalled();
    });

    test('trims and deduplicates IDs', async () => {
        mockGetProducts.mockResolvedValue({ data: { data: [{ id: 'sku-1' }, { id: 'sku-2' }] } });

        await fetchProductsByIds(mockContext, ['sku-1', '  sku-1  ', 'sku-2', 'sku-1', '  sku-2']);

        expect(mockGetProducts).toHaveBeenCalledWith({
            params: {
                query: {
                    ids: ['sku-1', 'sku-2'],
                },
            },
        });
    });

    test('maintains order after deduplication', async () => {
        mockGetProducts.mockResolvedValue({ data: { data: [] } });

        await fetchProductsByIds(mockContext, ['sku-b', 'sku-a', 'sku-b']);

        const calledIds = mockGetProducts.mock.calls[0][0].params.query.ids;
        expect(calledIds).toEqual(['sku-b', 'sku-a']);
    });

    test('passes options to API call', async () => {
        mockGetProducts.mockResolvedValue({ data: { data: [] } });

        await fetchProductsByIds(mockContext, ['sku-1'], { allImages: true, perPricebook: true, currency: 'USD' });

        expect(mockGetProducts).toHaveBeenCalledWith({
            params: {
                query: {
                    ids: ['sku-1'],
                    allImages: true,
                    perPricebook: true,
                    currency: 'USD',
                },
            },
        });
    });

    test('returns products array from response', async () => {
        const mockProducts = [{ id: 'sku-1' }, { id: 'sku-2' }];
        mockGetProducts.mockResolvedValue({ data: { data: mockProducts } });

        const result = await fetchProductsByIds(mockContext, ['sku-1', 'sku-2']);

        expect(result).toEqual(mockProducts);
    });

    test('returns empty array when API returns no data', async () => {
        mockGetProducts.mockResolvedValue({});

        const result = await fetchProductsByIds(mockContext, ['sku-1']);

        expect(result).toEqual([]);
    });

    test('throws NormalizedApiError when API call fails with ApiError', async () => {
        const error500 = new ApiError({
            status: 500,
            statusText: 'Server Error',
            headers: new Headers(),
            body: { type: 'Server Error', title: 'Server Error', detail: 'Internal error' },
            rawBody: JSON.stringify({ detail: 'Internal error' }),
            url: 'https://api.example.com/products',
            method: 'GET',
        });
        mockGetProducts.mockRejectedValue(error500);

        await expect(fetchProductsByIds(mockContext, ['sku-1'])).rejects.toThrow(NormalizedApiError);
        await expect(fetchProductsByIds(mockContext, ['sku-1'])).rejects.toMatchObject({ status: 500 });
    });

    test('throws NormalizedApiError when API call fails with non-API error', async () => {
        mockGetProducts.mockRejectedValue(new TypeError('Network failure'));

        await expect(fetchProductsByIds(mockContext, ['sku-1'])).rejects.toThrow(NormalizedApiError);
        await expect(fetchProductsByIds(mockContext, ['sku-1'])).rejects.toThrow('Network failure');
    });

    test('logs operation context when API call fails', async () => {
        const error500 = new ApiError({
            status: 500,
            statusText: 'Internal Server Error',
            headers: new Headers(),
            body: { type: 'Server Error', title: 'Server Error', detail: 'Server error' },
            rawBody: JSON.stringify({ detail: 'Server error' }),
            url: 'https://api.example.com/products',
            method: 'GET',
        });
        mockGetProducts.mockRejectedValue(error500);

        await fetchProductsByIds(mockContext, ['sku-a', '  sku-b  ', 'sku-a']).catch(() => {});

        expect(mockLoggerError).toHaveBeenCalledWith(
            'shopperProducts.getProducts failed',
            expect.objectContaining({ ids: ['sku-a', 'sku-b'] })
        );
    });
});
