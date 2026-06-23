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
import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import type { ShopperProducts } from '@/scapi';
import DefaultLayout, { loader, shouldRevalidate } from './_app';
import { AllProvidersWrapper } from '@/test-utils/context-provider';

vi.mock('@/lib/api/categories.server', () => ({
    fetchCategory: vi.fn(),
}));

vi.mock('@/components/header', () => ({
    default: ({ children }: { children?: ReactNode }) => <header data-testid="header">{children}</header>,
}));

vi.mock('@/components/footer', () => ({
    default: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('@/components/navigation-menu-mega', () => ({
    default: ({ resolve, defer }: { resolve?: unknown; defer?: unknown }) => (
        <nav data-testid="navigation-menu-mega" data-has-resolve={!!resolve} data-has-defer={!!defer}>
            Navigation
        </nav>
    ),
}));

vi.mock('@/lib/logger.server', () => ({
    getLogger: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    })),
}));

vi.mock('@salesforce/storefront-next-runtime/config', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@salesforce/storefront-next-runtime/config')>();
    const mockNavigationConfig = {
        rootCategoryId: 'root',
        maxDepth: 2,
        filter: {
            enabled: true,
            attribute: 'c_showInMenu',
            requireOnline: true,
        },
    };
    return {
        ...actual,
        getConfig: vi.fn(() => ({
            pages: {
                navigation: mockNavigationConfig,
            },
        })),
        useConfig: vi.fn(() => ({
            pages: {
                navigation: mockNavigationConfig,
            },
        })),
    };
});

describe('_app.tsx - Default Layout Route', () => {
    const mockCategory: ShopperProducts.schemas['Category'] = {
        id: 'root',
        name: 'Root Category',
    };

    const mockSubCategories: ShopperProducts.schemas['Category'][] = [
        { id: 'sub1', name: 'Sub Category 1' },
        { id: 'sub2', name: 'Sub Category 2' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render Header, main content area, and Footer', async () => {
            const Stub = createRoutesStub([
                {
                    id: 'root',
                    path: '/',
                    Component: DefaultLayout,
                    loader: () => ({
                        root: Promise.resolve(mockCategory),
                        subs: Promise.resolve(mockSubCategories),
                    }),
                    children: [
                        {
                            index: true,
                            Component: () => <div data-testid="child-content">Child Route Content</div>,
                        },
                    ],
                },
            ]);

            render(
                <AllProvidersWrapper>
                    <Stub initialEntries={['/']} />
                </AllProvidersWrapper>
            );

            await waitFor(() => {
                // Verify layout structure
                expect(screen.getByTestId('header')).toBeInTheDocument();
                expect(screen.getByTestId('footer')).toBeInTheDocument();
                expect(screen.getByTestId('navigation-menu-mega')).toBeInTheDocument();

                // Verify child content is rendered via Outlet
                expect(screen.getByTestId('child-content')).toBeInTheDocument();
            });
        });

        it('should render main element with correct styling', async () => {
            const Stub = createRoutesStub([
                {
                    id: 'root',
                    path: '/',
                    Component: DefaultLayout,
                    loader: () => ({
                        root: Promise.resolve(mockCategory),
                        subs: Promise.resolve(mockSubCategories),
                    }),
                    children: [
                        {
                            index: true,
                            Component: () => <div>Content</div>,
                        },
                    ],
                },
            ]);

            render(
                <AllProvidersWrapper>
                    <Stub initialEntries={['/']} />
                </AllProvidersWrapper>
            );

            await waitFor(() => {
                const main = screen.getByRole('main');
                expect(main).toBeInTheDocument();
                expect(main).toHaveClass('grow', 'pt-8');
            });
        });

        it('should pass category data to CategoryNavigationMenuMega', async () => {
            const Stub = createRoutesStub([
                {
                    id: 'root',
                    path: '/',
                    Component: DefaultLayout,
                    loader: () => ({
                        root: Promise.resolve(mockCategory),
                        subs: Promise.resolve(mockSubCategories),
                    }),
                    children: [
                        {
                            index: true,
                            Component: () => <div>Content</div>,
                        },
                    ],
                },
            ]);

            render(
                <AllProvidersWrapper>
                    <Stub initialEntries={['/']} />
                </AllProvidersWrapper>
            );

            await waitFor(() => {
                const nav = screen.getByTestId('navigation-menu-mega');
                expect(nav).toHaveAttribute('data-has-resolve', 'true');
                expect(nav).toHaveAttribute('data-has-defer', 'true');
            });
        });

        it('should handle missing root loader data gracefully', async () => {
            const Stub = createRoutesStub([
                {
                    id: 'root',
                    path: '/',
                    Component: DefaultLayout,
                    loader: () => ({
                        // No root or subs data
                    }),
                    children: [
                        {
                            index: true,
                            Component: () => <div data-testid="child-content">Content</div>,
                        },
                    ],
                },
            ]);

            render(
                <AllProvidersWrapper>
                    <Stub initialEntries={['/']} />
                </AllProvidersWrapper>
            );

            await waitFor(() => {
                // Layout should still render
                expect(screen.getByTestId('header')).toBeInTheDocument();
                expect(screen.getByTestId('footer')).toBeInTheDocument();
                expect(screen.getByTestId('child-content')).toBeInTheDocument();

                // Navigation should render but without data
                const nav = screen.getByTestId('navigation-menu-mega');
                expect(nav).toHaveAttribute('data-has-resolve', 'false');
                expect(nav).toHaveAttribute('data-has-defer', 'false');
            });
        });

        it('should preserve category refs across re-renders', async () => {
            const Stub = createRoutesStub([
                {
                    id: 'root',
                    path: '/',
                    Component: DefaultLayout,
                    loader: () => ({
                        root: Promise.resolve(mockCategory),
                        subs: Promise.resolve(mockSubCategories),
                    }),
                    children: [
                        {
                            index: true,
                            Component: () => <div>Content</div>,
                        },
                    ],
                },
            ]);

            const { rerender } = render(
                <AllProvidersWrapper>
                    <Stub initialEntries={['/']} />
                </AllProvidersWrapper>
            );

            await waitFor(() => {
                // First render should have data
                expect(screen.getByTestId('navigation-menu-mega')).toHaveAttribute('data-has-resolve', 'true');
            });

            // Re-render should preserve the refs
            rerender(
                <AllProvidersWrapper>
                    <Stub initialEntries={['/']} />
                </AllProvidersWrapper>
            );
            await waitFor(() => {
                expect(screen.getByTestId('navigation-menu-mega')).toHaveAttribute('data-has-resolve', 'true');
            });
        });
    });

    describe('shouldRevalidate', () => {
        it('should always return false to prevent revalidation', () => {
            expect(shouldRevalidate()).toBe(false);
        });
    });

    describe('loader', () => {
        it('should load root category with level 1', async () => {
            const { fetchCategory } = await import('@/lib/api/categories.server');
            const mockFetchCategory = vi.mocked(fetchCategory);

            const mockRootCategory: ShopperProducts.schemas['Category'] = {
                id: 'root',
                name: 'Root',
                categories: [],
            };

            mockFetchCategory.mockResolvedValue(mockRootCategory);

            const mockContext = {} as any;
            const result = loader({ context: mockContext } as any);

            expect(mockFetchCategory).toHaveBeenCalledWith(mockContext, 'root', 1);
            expect(result).toHaveProperty('root');
            expect(result).toHaveProperty('subs');

            const rootCategory = await result.root;
            expect(rootCategory).toEqual(mockRootCategory);
        });

        it('should load subcategories for categories with onlineSubCategoriesCount > 0', async () => {
            const { fetchCategory } = await import('@/lib/api/categories.server');
            const mockFetchCategory = vi.mocked(fetchCategory);

            const mockRootCategory: ShopperProducts.schemas['Category'] = {
                id: 'root',
                name: 'Root',
                categories: [
                    { id: 'cat1', name: 'Category 1', onlineSubCategoriesCount: 3 },
                    { id: 'cat2', name: 'Category 2', onlineSubCategoriesCount: 0 },
                    { id: 'cat3', name: 'Category 3', onlineSubCategoriesCount: 5 },
                ],
            };

            const mockSubCategory1: ShopperProducts.schemas['Category'] = {
                id: 'cat1',
                name: 'Category 1',
                categories: [{ id: 'sub1', name: 'Sub 1' }],
            };

            const mockSubCategory3: ShopperProducts.schemas['Category'] = {
                id: 'cat3',
                name: 'Category 3',
                categories: [{ id: 'sub3', name: 'Sub 3' }],
            };

            mockFetchCategory
                .mockResolvedValueOnce(mockRootCategory)
                .mockResolvedValueOnce(mockSubCategory1)
                .mockResolvedValueOnce(mockSubCategory3);

            const mockContext = {} as any;
            const result = loader({ context: mockContext } as any);

            const subs = await result.subs;

            expect(mockFetchCategory).toHaveBeenCalledTimes(3);
            expect(mockFetchCategory).toHaveBeenCalledWith(mockContext, 'root', 1);
            expect(mockFetchCategory).toHaveBeenCalledWith(mockContext, 'cat1', 2);
            expect(mockFetchCategory).toHaveBeenCalledWith(mockContext, 'cat3', 2);
            expect(mockFetchCategory).not.toHaveBeenCalledWith(mockContext, 'cat2', 2);
            expect(subs).toHaveLength(2);
            expect(subs).toEqual([mockSubCategory1, mockSubCategory3]);
        });

        it('should handle root category without subcategories', async () => {
            const { fetchCategory } = await import('@/lib/api/categories.server');
            const mockFetchCategory = vi.mocked(fetchCategory);

            const mockRootCategory: ShopperProducts.schemas['Category'] = {
                id: 'root',
                name: 'Root',
                categories: [],
            };

            mockFetchCategory.mockResolvedValue(mockRootCategory);

            const mockContext = {} as any;
            const result = loader({ context: mockContext } as any);

            const subs = await result.subs;

            expect(mockFetchCategory).toHaveBeenCalledTimes(1);
            expect(subs).toEqual([]);
        });

        it('should handle root category with undefined categories array', async () => {
            const { fetchCategory } = await import('@/lib/api/categories.server');
            const mockFetchCategory = vi.mocked(fetchCategory);

            const mockRootCategory: ShopperProducts.schemas['Category'] = {
                id: 'root',
                name: 'Root',
            };

            mockFetchCategory.mockResolvedValue(mockRootCategory);

            const mockContext = {} as any;
            const result = loader({ context: mockContext } as any);

            const subs = await result.subs;

            expect(mockFetchCategory).toHaveBeenCalledTimes(1);
            expect(subs).toEqual([]);
        });

        it('should return promises that can be used for streaming', async () => {
            const { fetchCategory } = await import('@/lib/api/categories.server');
            const mockFetchCategory = vi.mocked(fetchCategory);

            const mockRootCategory: ShopperProducts.schemas['Category'] = {
                id: 'root',
                name: 'Root',
                categories: [{ id: 'cat1', name: 'Category 1', onlineSubCategoriesCount: 2 }],
            };

            mockFetchCategory.mockResolvedValue(mockRootCategory);

            const mockContext = {} as any;
            const result = loader({ context: mockContext } as any);

            expect(result.root).toBeInstanceOf(Promise);
            expect(result.subs).toBeInstanceOf(Promise);

            const rootResolved = await result.root;
            expect(rootResolved).toEqual(mockRootCategory);
        });
    });
});
