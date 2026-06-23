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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { ProductTileProvider, useProductTileContext } from './context';

const mockNavigate = vi.fn();

vi.mock('react-router', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: (ns: string) => ({
        t: (key: string) => `${ns}:${key}`,
        i18n: { language: 'en-US' },
    }),
}));

/**
 * Helper to render a hook within the full provider stack (Router + Config).
 */
function createRouterWrapper() {
    return function RouterWrapper({ children }: PropsWithChildren) {
        const router = createMemoryRouter(
            [
                {
                    path: '/',
                    element: <AllProvidersWrapper>{children}</AllProvidersWrapper>,
                },
            ],
            { initialEntries: ['/'] }
        );
        return <RouterProvider router={router} />;
    };
}

/**
 * Helper to render a hook within the full provider stack including ProductTileProvider.
 */
function createProviderWrapper() {
    return function ProviderWrapper({ children }: PropsWithChildren) {
        const router = createMemoryRouter(
            [
                {
                    path: '/',
                    element: (
                        <AllProvidersWrapper>
                            <ProductTileProvider>{children}</ProductTileProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/'] }
        );
        return <RouterProvider router={router} />;
    };
}

describe('ProductTileProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('renders children', () => {
        const router = createMemoryRouter(
            [
                {
                    path: '/',
                    element: (
                        <AllProvidersWrapper>
                            <ProductTileProvider>
                                <div data-testid="child">Hello</div>
                            </ProductTileProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/'] }
        );

        render(<RouterProvider router={router} />);
        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    test('provides context value to children', () => {
        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        expect(result.current).toEqual(
            expect.objectContaining({
                navigate: expect.any(Function),
                currency: 'USD',
                swatchMode: expect.stringMatching(/^(click|hover)$/),
            })
        );
        expect(result.current.config).toBeDefined();
        expect(result.current.t).toBeTypeOf('function');
        expect(result.current.getBadges).toBeTypeOf('function');
    });

    test('provides the translation function scoped to "product" namespace', () => {
        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        expect(result.current.t('moreOptions')).toBe('product:moreOptions');
    });

    test('provides the currency from SiteProvider', () => {
        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        expect(result.current.currency).toBe('USD');
    });

    test('provides navigate function from react-router', () => {
        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        void result.current.navigate('/product/123');
        // The navigate wrapper prepends the site/locale prefix before calling the router navigate
        expect(mockNavigate).toHaveBeenCalledWith('/global/en-US/product/123', undefined);
    });
});

describe('useProductTileContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('returns context from provider when inside ProductTileProvider', () => {
        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        // Navigate is a site context wrapper around the mocked useNavigate
        expect(result.current.navigate).toBeTypeOf('function');
        expect(result.current.config).toBeDefined();
        expect(result.current.t).toBeTypeOf('function');
        expect(result.current.currency).toBe('USD');
        expect(result.current.swatchMode).toMatch(/^(click|hover)$/);
        expect(result.current.getBadges).toBeTypeOf('function');
    });

    test('falls back to direct hook calls when outside ProductTileProvider', () => {
        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createRouterWrapper(),
        });

        // Navigate is a site context wrapper around the mocked useNavigate
        expect(result.current.navigate).toBeTypeOf('function');
        expect(result.current.config).toBeDefined();
        expect(result.current.t).toBeTypeOf('function');
        expect(result.current.currency).toBe('USD');
        expect(result.current.swatchMode).toMatch(/^(click|hover)$/);
        expect(result.current.getBadges).toBeTypeOf('function');
    });

    test('returns identical shape whether inside or outside provider', () => {
        const { result: withProvider } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        const { result: withoutProvider } = renderHook(() => useProductTileContext(), {
            wrapper: createRouterWrapper(),
        });

        const keys = Object.keys(withProvider.current).sort();
        const fallbackKeys = Object.keys(withoutProvider.current).sort();
        expect(keys).toEqual(fallbackKeys);
        expect(keys).toEqual(['config', 'currency', 'getBadges', 'navigate', 'swatchMode', 't']);
    });
});

describe('getBadges (via useProductTileContext)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('returns badges and hasBadges for a product with matching properties', () => {
        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        const product = {
            productId: 'test-product',
            representedProduct: { c_isSale: true },
        } as never;

        const badgeResult = result.current.getBadges(product);
        expect(badgeResult.hasBadges).toBe(true);
        expect(badgeResult.badges.length).toBeGreaterThan(0);
        expect(badgeResult.badges[0].label).toBe('Sale');
    });

    test('returns empty badges for a product without badge properties', () => {
        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        const product = {
            productId: 'plain-product',
        } as never;

        const badgeResult = result.current.getBadges(product);
        expect(badgeResult.hasBadges).toBe(false);
        expect(badgeResult.badges).toEqual([]);
    });

    test('returns identical results from provider and fallback paths', () => {
        const product = {
            productId: 'test-product',
            representedProduct: { c_isSale: true, c_isNew: true },
        } as never;

        const { result: withProvider } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        const { result: withoutProvider } = renderHook(() => useProductTileContext(), {
            wrapper: createRouterWrapper(),
        });

        const fromProvider = withProvider.current.getBadges(product);
        const fromFallback = withoutProvider.current.getBadges(product);

        expect(fromProvider.hasBadges).toBe(fromFallback.hasBadges);
        expect(fromProvider.badges.map((b) => b.label)).toEqual(fromFallback.badges.map((b) => b.label));
    });
});

describe('useSwatchMode (via useProductTileContext)', () => {
    let originalMatchMedia: typeof globalThis.matchMedia;

    beforeEach(() => {
        vi.clearAllMocks();
        originalMatchMedia = globalThis.matchMedia;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        globalThis.matchMedia = originalMatchMedia;
    });

    test('returns "click" when viewport is below 1024px (mobile)', () => {
        globalThis.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        expect(result.current.swatchMode).toBe('click');
    });

    test('returns "hover" when viewport is at or above 1024px (desktop)', () => {
        globalThis.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: true,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        expect(result.current.swatchMode).toBe('hover');
    });

    test('updates swatchMode when media query changes', () => {
        let changeCallback: (() => void) | null = null;
        let currentMatches = false;

        globalThis.matchMedia = vi.fn().mockImplementation((query: string) => ({
            get matches() {
                return currentMatches;
            },
            media: query,
            addEventListener: vi.fn((_event: string, cb: () => void) => {
                changeCallback = cb;
            }),
            removeEventListener: vi.fn(),
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        expect(result.current.swatchMode).toBe('click');

        // Simulate viewport change to desktop
        currentMatches = true;
        act(() => {
            changeCallback?.();
        });

        expect(result.current.swatchMode).toBe('hover');
    });

    test('cleans up media query listener on unmount', () => {
        const removeEventListener = vi.fn();

        globalThis.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { unmount } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        unmount();

        expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    test('returns "click" as server snapshot (when matchMedia is unavailable)', () => {
        // Simulate server environment where matchMedia is not available
        globalThis.matchMedia = undefined as unknown as typeof globalThis.matchMedia;

        const { result } = renderHook(() => useProductTileContext(), {
            wrapper: createProviderWrapper(),
        });

        // Without matchMedia, getSwatchModeSnapshot returns 'click' (falsy ?. chain)
        expect(result.current.swatchMode).toBe('click');
    });
});
