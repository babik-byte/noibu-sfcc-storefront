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
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { type DataStrategyResult, RouterContextProvider } from 'react-router';
import legacyRoutesMiddleware, { matchesRoutePattern } from '@/middlewares/legacy-routes.client';
import { appConfigContext } from '@salesforce/storefront-next-runtime/config';
import type { AppConfig } from '@/types/config';
import { getSiteRef, mockAltSiteObject, mockSiteObject } from '@/test-utils/config';

describe('legacyRoutesMiddleware', () => {
    let mockContext: RouterContextProvider;
    let mockNext: ReturnType<typeof vi.fn<() => Promise<Record<string, DataStrategyResult>>>>;

    beforeEach(() => {
        mockContext = new RouterContextProvider();
        mockNext = vi.fn<() => Promise<Record<string, DataStrategyResult>>>().mockResolvedValue({});

        // Mock context.get to return config
        vi.spyOn(mockContext, 'get').mockImplementation((contextKey: any) => {
            if (contextKey === appConfigContext) {
                return {
                    hybrid: {
                        enabled: true,
                        legacyRoutes: ['/checkout', '/account', '/s/'],
                    },
                } as unknown as AppConfig;
            }
            return undefined;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('server-side behavior', () => {
        test('should skip middleware on server-side (window undefined)', async () => {
            // Simulate server-side by stubbing window as undefined
            vi.stubGlobal('window', undefined);

            const request = new Request('https://example.com/checkout');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('client-side behavior with hybrid disabled', () => {
        beforeEach(() => {
            // Mock window for client-side
            vi.stubGlobal('window', {} as Window & typeof globalThis);

            // Override config to disable hybrid
            vi.spyOn(mockContext, 'get').mockImplementation((contextKey: any) => {
                if (contextKey === appConfigContext) {
                    return {
                        hybrid: {
                            enabled: false,
                            legacyRoutes: ['/checkout'],
                        },
                    } as unknown as AppConfig;
                }
                return undefined;
            });
        });

        test('should skip when hybrid mode is disabled', async () => {
            const request = new Request('https://example.com/checkout');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('client-side behavior with no legacy routes', () => {
        beforeEach(() => {
            vi.stubGlobal('window', {} as Window & typeof globalThis);

            vi.spyOn(mockContext, 'get').mockImplementation((contextKey: any) => {
                if (contextKey === appConfigContext) {
                    return {
                        hybrid: {
                            enabled: true,
                            legacyRoutes: [],
                        },
                    } as unknown as AppConfig;
                }
                return undefined;
            });
        });

        test('should skip when legacyRoutes is empty', async () => {
            const request = new Request('https://example.com/checkout');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });

        test('should skip when legacyRoutes is undefined', async () => {
            vi.spyOn(mockContext, 'get').mockImplementation((contextKey: any) => {
                if (contextKey === appConfigContext) {
                    return {
                        hybrid: {
                            enabled: true,
                            // legacyRoutes is undefined
                        },
                    } as unknown as AppConfig;
                }
                return undefined;
            });

            const request = new Request('https://example.com/checkout');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('client-side legacy route matching', () => {
        beforeEach(() => {
            // Mock window for client-side - simple object that allows property access
            vi.stubGlobal('window', { location: { href: '' } } as Window & typeof globalThis);
        });

        test('should trigger redirect path when path matches legacy route exactly', () => {
            const request = new Request('https://example.com/checkout');

            // Don't await — the middleware returns a never-resolving promise on redirect paths
            // (keeps React Router suspended while the browser navigates away)
            void legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            // window.location.href is set synchronously before the promise
            expect(mockNext).not.toHaveBeenCalled();
            expect(window.location.href).toContain('checkout');
            expect(window.location.href).toContain('redirected=1');
        });

        test('should not redirect when path does not exactly match', async () => {
            const request = new Request('https://example.com/checkout/payment');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            // Should continue normal navigation since /checkout/payment !== /checkout
            expect(mockNext).toHaveBeenCalledOnce();
        });

        test('should trigger redirect path and preserve existing query params', () => {
            const request = new Request('https://example.com/checkout?step=2&item=abc');

            void legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(window.location.href).toContain('step=2');
            expect(window.location.href).toContain('item=abc');
            expect(window.location.href).toContain('redirected=1');
        });

        test('should trigger redirect path and preserve hash fragment', () => {
            const request = new Request('https://example.com/checkout#payment');

            void legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(window.location.href).toContain('checkout');
            expect(window.location.href).toContain('redirected=1');
        });

        test('should continue normal navigation when path does not match', async () => {
            const request = new Request('https://example.com/product/123');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });

        test('should only match exact paths configured in legacyRoutes', async () => {
            // /s/ is in legacyRoutes, but a full legacy path like /s/<siteId>/en_US/Cart-Show is not
            const request = new Request(`https://example.com/s/${mockAltSiteObject.id}/en_US/Cart-Show`);

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            // Should continue normal navigation since it's not an exact match
            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('infinite loop prevention', () => {
        beforeEach(() => {
            // Mock window for client-side
            vi.stubGlobal('window', { location: { href: '' } } as Window & typeof globalThis);
        });

        test('should not redirect when redirected=1 query param is present', async () => {
            const request = new Request('https://example.com/checkout?redirected=1');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });

        test('should let React Router handle 404 after one redirect attempt', async () => {
            const request = new Request('https://example.com/checkout?redirected=1&other=param');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            // Should not redirect again, let it fall through to React Router
            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('edge cases', () => {
        beforeEach(() => {
            // Mock window for client-side
            vi.stubGlobal('window', { location: { href: '' } } as Window & typeof globalThis);
        });

        test('should handle config with null hybrid property', async () => {
            vi.spyOn(mockContext, 'get').mockImplementation((contextKey: any) => {
                if (contextKey === appConfigContext) {
                    return {
                        hybrid: null,
                    } as unknown as AppConfig;
                }
                return undefined;
            });

            const request = new Request('https://example.com/checkout');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });

        test('should handle missing config gracefully', async () => {
            vi.spyOn(mockContext, 'get').mockReturnValue(undefined);

            const request = new Request('https://example.com/checkout');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });

        test('should use exact matching, not prefix matching', async () => {
            // /account is a legacy route, but /accounts is not (exact matching)
            const request = new Request('https://example.com/accounts/profile');

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            // Should continue normal navigation since /accounts/profile !== /account
            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('matchesRoutePattern', () => {
        test('should match exact routes', () => {
            expect(matchesRoutePattern('/checkout', '/checkout')).toBe(true);
            expect(matchesRoutePattern('/account/orders', '/account/orders')).toBe(true);
            expect(matchesRoutePattern('/checkout', '/account')).toBe(false);
            expect(matchesRoutePattern('/checkout/payment', '/checkout')).toBe(false);
        });

        test('should match single parameter routes', () => {
            expect(matchesRoutePattern('/product/123', '/product/:id')).toBe(true);
            expect(matchesRoutePattern('/product/abc-xyz', '/product/:id')).toBe(true);
            expect(matchesRoutePattern('/user/john-doe', '/user/:username')).toBe(true);
            // Should not match different base paths
            expect(matchesRoutePattern('/products/123', '/product/:id')).toBe(false);
            // Should not match with extra or missing segments
            expect(matchesRoutePattern('/product/123/details', '/product/:id')).toBe(false);
            expect(matchesRoutePattern('/product', '/product/:id')).toBe(false);
        });

        test('should match multiple parameter routes', () => {
            expect(matchesRoutePattern('/category/shoes/item/123', '/category/:cat/item/:id')).toBe(true);
            expect(matchesRoutePattern('/store/NYC/product/abc', '/store/:location/product/:id')).toBe(true);
            expect(matchesRoutePattern('/checkout/step/1', '/checkout/step/:id')).toBe(true);
            // Should not match with wrong segments
            expect(matchesRoutePattern('/category/shoes', '/category/:cat/item/:id')).toBe(false);
            expect(matchesRoutePattern('/category/shoes/item/123/view', '/category/:cat/item/:id')).toBe(false);
        });

        test('should handle special cases', () => {
            // Special regex characters in paths
            expect(matchesRoutePattern('/path.with.dots/123', '/path.with.dots/:id')).toBe(true);
            expect(matchesRoutePattern('/pathXwithXdots/123', '/path.with.dots/:id')).toBe(false);
            // Parameters should not match slashes
            expect(matchesRoutePattern('/product/123/456', '/product/:id')).toBe(false);
        });

        test('should match trailing wildcard patterns across any depth', () => {
            // Single segment, multi-segment, and empty tail all match
            expect(matchesRoutePattern('/categoryLv1/shoes', '/categoryLv1/*')).toBe(true);
            expect(matchesRoutePattern('/categoryLv1/shoes/running', '/categoryLv1/*')).toBe(true);
            expect(matchesRoutePattern('/categoryLv1/', '/categoryLv1/*')).toBe(true);
            // Different base path should not match
            expect(matchesRoutePattern('/categoryLv2/shoes', '/categoryLv1/*')).toBe(false);
            // Parent path without the trailing slash does not match the '/categoryLv1/*' form
            expect(matchesRoutePattern('/categoryLv1', '/categoryLv1/*')).toBe(false);
        });

        test('should match a wildcard combined with a named param', () => {
            // Named param stays single-segment; wildcard absorbs the rest
            expect(matchesRoutePattern('/category/shoes/details/blue', '/category/:cat/*')).toBe(true);
            expect(matchesRoutePattern('/category/shoes/', '/category/:cat/*')).toBe(true);
        });

        test('should match a root wildcard against any path', () => {
            expect(matchesRoutePattern('/anything', '*')).toBe(true);
            expect(matchesRoutePattern('/a/b/c', '*')).toBe(true);
        });

        test('should match wildcards in the middle of a pattern', () => {
            // '*' is not restricted to a trailing splat — it matches any content (including '/') anywhere
            expect(matchesRoutePattern('/api/v1/data', '/api/*/data')).toBe(true);
            expect(matchesRoutePattern('/api/v1/v2/data', '/api/*/data')).toBe(true);
            expect(matchesRoutePattern('/api/data', '/api/*/data')).toBe(false);
            // Combine prefix + suffix around a non-trailing '*'
            expect(matchesRoutePattern('/files/photo-thumb', '/files/*-thumb')).toBe(true);
            expect(matchesRoutePattern('/files/photo-full', '/files/*-thumb')).toBe(false);
        });
    });

    describe('multisite prefix stripping', () => {
        beforeEach(() => {
            vi.stubGlobal('window', { location: { href: '' } } as Window & typeof globalThis);

            vi.spyOn(mockContext, 'get').mockImplementation((contextKey: any) => {
                if (contextKey === appConfigContext) {
                    return {
                        hybrid: {
                            enabled: true,
                            legacyRoutes: ['/checkout', '/account/orders', '/product/:id'],
                        },
                        url: {
                            prefix: '/:siteId/:localeId',
                        },
                    } as unknown as AppConfig;
                }
                return undefined;
            });
        });

        test('should redirect when multisite-prefixed URL matches a bare legacy route', () => {
            const siteRef = getSiteRef();
            const locale = mockSiteObject.defaultLocale;
            const request = new Request(`https://example.com/${siteRef}/${locale}/checkout`);

            void legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(window.location.href).toContain('redirected=1');
            // Navigation target must be the stripped pathname so the legacy backend (or local
            // hybrid proxy) can apply its own prefix without doubling up on storefront-next's.
            expect(window.location.href).toBe('https://example.com/checkout?redirected=1');
        });

        test('should redirect for parameterized legacy routes with multisite prefix', () => {
            const siteRef = getSiteRef();
            const locale = mockSiteObject.defaultLocale;
            const request = new Request(`https://example.com/${siteRef}/${locale}/product/123`);

            void legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(window.location.href).toContain('redirected=1');
            expect(window.location.href).toBe('https://example.com/product/123?redirected=1');
        });

        test('should preserve query params and hash when stripping prefix', () => {
            const siteRef = getSiteRef();
            const locale = mockSiteObject.defaultLocale;
            const request = new Request(`https://example.com/${siteRef}/${locale}/checkout?step=2&item=abc#payment`);

            void legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(window.location.href).toBe('https://example.com/checkout?step=2&item=abc&redirected=1#payment');
        });

        test('should not redirect for non-legacy multisite routes', async () => {
            const request = new Request(
                `https://example.com/${getSiteRef()}/${mockSiteObject.defaultLocale}/category/womens`
            );

            await legacyRoutesMiddleware({ request, context: mockContext, params: {}, unstable_pattern: '' }, mockNext);

            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('client-side parameterized route matching', () => {
        beforeEach(() => {
            vi.stubGlobal('window', { location: { href: '' } } as Window & typeof globalThis);

            vi.spyOn(mockContext, 'get').mockImplementation((contextKey: any) => {
                if (contextKey === appConfigContext) {
                    return {
                        hybrid: {
                            enabled: true,
                            legacyRoutes: [
                                '/checkout',
                                '/product/:id',
                                '/category/:cat/item/:id',
                                '/user/:username/profile',
                            ],
                        },
                    } as unknown as AppConfig;
                }
                return undefined;
            });
        });

        test('should trigger redirects for parameterized routes', () => {
            const testCases = [
                'https://example.com/product/123', // Single parameter
                'https://example.com/category/electronics/item/abc-123', // Multiple parameters
                'https://example.com/user/john-doe/profile', // Mixed route
                'https://example.com/checkout', // Exact match alongside parameterized
                'https://example.com/product/123?color=blue&size=large', // With query params
                'https://example.com/product/123#reviews', // With hash
                'https://example.com/product/abc-123_xyz', // Hyphens and underscores
            ];

            for (const url of testCases) {
                // Reset window.location.href before each iteration
                (window as any).location.href = '';
                const request = new Request(url);
                void legacyRoutesMiddleware(
                    { request, context: mockContext, params: {}, unstable_pattern: '' },
                    mockNext
                );
                expect(mockNext).not.toHaveBeenCalled();
                expect(window.location.href).toContain('redirected=1');
                mockNext.mockClear();
            }
        });

        test('should continue normal navigation when routes do not match', async () => {
            const testCases = [
                'https://example.com/product/123/details', // Extra segments
                'https://example.com/category/shoes', // Missing segments
                'https://example.com/products/123', // Different base path
            ];

            for (const url of testCases) {
                const request = new Request(url);
                await legacyRoutesMiddleware(
                    { request, context: mockContext, params: {}, unstable_pattern: '' },
                    mockNext
                );
                expect(mockNext).toHaveBeenCalledOnce();
                mockNext.mockClear();
            }
        });
    });
});
