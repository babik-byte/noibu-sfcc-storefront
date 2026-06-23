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
import { createRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, test } from 'vitest';
import i18next from 'i18next';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { Link, NavLink } from './index';

function renderWithRouter(ui: React.ReactElement) {
    const router = createMemoryRouter([{ path: '*', element: <AllProvidersWrapper>{ui}</AllProvidersWrapper> }], {
        initialEntries: ['/'],
    });
    return render(<RouterProvider router={router} />);
}

describe('Link', () => {
    afterEach(async () => {
        cleanup();
        await i18next.changeLanguage('en-GB');
    });

    test('renders a site context prefixed URL', () => {
        const { getByRole } = renderWithRouter(<Link to="/product/123">Product</Link>);

        expect(getByRole('link')).toHaveAttribute('href', '/global/en-GB/product/123');
    });

    test('passes through an object `to` prop without transformation', () => {
        const { getByRole } = renderWithRouter(
            <Link to={{ pathname: '/product/123', search: '?color=red' }}>Product</Link>
        );

        expect(getByRole('link')).toHaveAttribute('href', '/product/123?color=red');
    });

    test('forwards a ref to the anchor element', () => {
        const ref = createRef<HTMLAnchorElement>();
        renderWithRouter(
            <Link to="/test" ref={ref}>
                Test
            </Link>
        );

        expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
    });

    test('uses the current i18n language for locale segment', async () => {
        await i18next.changeLanguage('it-IT');

        const { getByRole } = renderWithRouter(<Link to="/product/123">Product</Link>);

        expect(getByRole('link')).toHaveAttribute('href', '/global/it-IT/product/123');
    });

    test('passes additional props to the rendered anchor', () => {
        const { getByRole } = renderWithRouter(
            <Link to="/test" className="my-link" data-testid="custom">
                Test
            </Link>
        );

        const link = getByRole('link');
        expect(link).toHaveClass('my-link');
        expect(link).toHaveAttribute('data-testid', 'custom');
    });

    test('prefixes root path "/" with site context', () => {
        const { getByRole } = renderWithRouter(<Link to="/">Home</Link>);

        expect(getByRole('link')).toHaveAttribute('href', '/global/en-GB/');
    });
});

describe('NavLink', () => {
    afterEach(async () => {
        cleanup();
        await i18next.changeLanguage('en-GB');
    });

    test('renders a site context prefixed URL', () => {
        const { getByRole } = renderWithRouter(<NavLink to="/product/123">Product</NavLink>);

        expect(getByRole('link')).toHaveAttribute('href', '/global/en-GB/product/123');
    });

    test('passes through an object `to` prop without transformation', () => {
        const { getByRole } = renderWithRouter(
            <NavLink to={{ pathname: '/product/123', search: '?color=red' }}>Product</NavLink>
        );

        expect(getByRole('link')).toHaveAttribute('href', '/product/123?color=red');
    });

    test('forwards a ref to the anchor element', () => {
        const ref = createRef<HTMLAnchorElement>();
        renderWithRouter(
            <NavLink to="/test" ref={ref}>
                Test
            </NavLink>
        );

        expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
    });

    test('uses the current i18n language for locale segment', async () => {
        await i18next.changeLanguage('it-IT');

        const { getByRole } = renderWithRouter(<NavLink to="/product/123">Product</NavLink>);

        expect(getByRole('link')).toHaveAttribute('href', '/global/it-IT/product/123');
    });

    test('passes additional props to the rendered anchor', () => {
        const { getByRole } = renderWithRouter(
            <NavLink to="/test" className="my-navlink" data-testid="custom">
                Test
            </NavLink>
        );

        const link = getByRole('link');
        expect(link).toHaveClass('my-navlink');
        expect(link).toHaveAttribute('data-testid', 'custom');
    });

    test('prefixes root path "/" with site context', () => {
        const { getByRole } = renderWithRouter(<NavLink to="/">Home</NavLink>);

        expect(getByRole('link')).toHaveAttribute('href', '/global/en-GB/');
    });
});
