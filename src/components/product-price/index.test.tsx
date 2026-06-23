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

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductPrice from './index';

describe('ProductPrice', () => {
    const mockProduct = {
        id: 'test-product',
        name: 'Test Product',
        price: 29.99,
        priceMax: 39.99,
        hitType: 'product' as const,
        type: {},
        variants: [],
        tieredPrices: [
            { quantity: 1, price: 29.99 },
            { quantity: 5, price: 39.99 },
        ],
    };

    test('renders current price and list price for standard product', () => {
        render(<ProductPrice product={mockProduct} currency="USD" labelForA11y="Test Product" />);

        // Price range displayed as min – max (no "From" prefix)
        expect(screen.getByText('$29.99 – $39.99')).toBeInTheDocument();
    });

    test('renders only current price for set product', () => {
        const setProduct = {
            ...mockProduct,
            hitType: 'set' as const,
            type: { set: true },
        };

        render(<ProductPrice product={setProduct} currency="USD" labelForA11y="Test Set" />);

        // Set product with price range shows min – max
        expect(screen.getByText('$29.99 – $39.99')).toBeInTheDocument();
    });

    test('renders current price only when not on sale', () => {
        const noSaleProduct = {
            ...mockProduct,
            priceMax: undefined,
            tieredPrices: [{ quantity: 1, price: 29.99 }],
        };

        render(<ProductPrice product={noSaleProduct} currency="USD" labelForA11y="Test Product" />);

        expect(screen.getByText('$29.99')).toBeInTheDocument();
        expect(screen.queryByText('$39.99')).not.toBeInTheDocument();
    });

    test('applies custom className', () => {
        const { container } = render(
            <ProductPrice product={mockProduct} currency="USD" labelForA11y="Test Product" className="custom-class" />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });

    test('handles quantity multiplication', () => {
        render(<ProductPrice product={mockProduct} currency="USD" quantity={2} labelForA11y="Test Product" />);

        // Quantity multiplies range: 29.99*2 – 39.99*2
        expect(screen.getByText('$59.98 – $79.98')).toBeInTheDocument();
    });

    test('does not apply quantity multiplication when type is unit', () => {
        render(
            <ProductPrice product={mockProduct} currency="USD" quantity={2} labelForA11y="Test Product" type="unit" />
        );

        // Unit type: show range per unit, no quantity multiplication
        expect(screen.getByText('$29.99 – $39.99')).toBeInTheDocument();
        expect(screen.queryByText('$59.98 – $79.98')).not.toBeInTheDocument();
    });
});
