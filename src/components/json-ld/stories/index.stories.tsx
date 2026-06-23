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
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { JsonLd } from '../index';

const meta: Meta<typeof JsonLd> = {
    title: 'SEO/JsonLd',
    component: JsonLd,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: `
JsonLd component that injects structured data into the page for SEO and AI systems.

This component renders a \`<script type="application/ld+json">\` tag containing
structured data following the JSON-LD format. The structured data helps search
engines and AI systems understand the content of the page.

The component should be placed in page components (e.g., PDP, PLP) and will be
rendered during server-side rendering, ensuring crawlers can immediately see the
structured data in the HTML response.

**Important Notes:**
- The component renders in the page body (not in \`<head>\`), which is acceptable
  for JSON-LD as it works in both locations
- The data object will be stringified as JSON, so ensure it's a valid JSON-serializable object
- For best SEO results, ensure the data follows schema.org specifications
                `,
            },
        },
    },
    argTypes: {
        data: {
            description: 'The JSON-LD structured data object to inject into the page',
            control: 'object',
        },
        id: {
            description:
                'Optional unique identifier for the script tag (useful when multiple JSON-LD scripts are on the same page)',
            control: 'text',
        },
    },
};

export default meta;
type Story = StoryObj<typeof JsonLd>;

export const ProductSchema: Story = {
    args: {
        data: {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Kenmore White 17" Microwave',
            description:
                '0.7 cubic feet countertop microwave. Has six preset cooking categories and convenience features like Add-A-Minute and Child Lock.',
            image: 'kenmore-microwave-17in.jpg',
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '3.5',
                reviewCount: '11',
            },
            offers: {
                '@type': 'Offer',
                availability: 'https://schema.org/InStock',
                price: '55.00',
                priceCurrency: 'USD',
            },
        },
        id: 'product-schema',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const script =
            canvasElement.querySelector('#product-schema') ||
            canvasElement.querySelector('script[type="application/ld+json"]');
        await expect(script).toBeInTheDocument();
        if (script) {
            const jsonContent = JSON.parse(script.textContent || '{}');
            await expect(jsonContent['@type']).toBe('Product');
            await expect(jsonContent.name).toBe('Kenmore White 17" Microwave');
        }
    },
    render: (args) => (
        <div>
            <JsonLd {...args} />
            <div className="mt-4 p-4 bg-muted rounded">
                <p className="text-sm font-semibold mb-2">JSON-LD Script Tag (invisible, check page source):</p>
                <p className="text-xs text-muted-foreground">
                    The script tag is rendered above. In a real page, this would be in the HTML for crawlers to parse.
                </p>
            </div>
        </div>
    ),
};

export const ProductSchemaWithReviews: Story = {
    args: {
        data: {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Premium Cotton T-Shirt',
            description: 'Made from 100% organic cotton, this comfortable t-shirt features a classic fit.',
            image: 'premium-tshirt.jpg',
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.5',
                reviewCount: '24',
            },
            offers: {
                '@type': 'Offer',
                availability: 'https://schema.org/InStock',
                price: '29.99',
                priceCurrency: 'USD',
            },
            review: [
                {
                    '@type': 'Review',
                    author: 'John Doe',
                    datePublished: '2024-01-15',
                    reviewBody: 'Great quality and comfortable fit. Highly recommend!',
                    name: 'Excellent Product',
                    reviewRating: {
                        '@type': 'Rating',
                        bestRating: '5',
                        ratingValue: '5',
                        worstRating: '1',
                    },
                },
                {
                    '@type': 'Review',
                    author: 'Jane Smith',
                    datePublished: '2024-01-20',
                    reviewBody: 'Good value for money, but sizing runs a bit small.',
                    name: 'Good but size down',
                    reviewRating: {
                        '@type': 'Rating',
                        bestRating: '5',
                        ratingValue: '4',
                        worstRating: '1',
                    },
                },
            ],
        },
        id: 'product-schema-reviews',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const script = canvasElement.querySelector('script[type="application/ld+json"]');
        await expect(script).toBeInTheDocument();
        if (script) {
            const jsonContent = JSON.parse(script.textContent || '{}');
            await expect(jsonContent['@type']).toBe('Product');
            await expect(Array.isArray(jsonContent.review)).toBe(true);
            await expect(jsonContent.review.length).toBe(2);
        }
    },
    render: (args) => (
        <div>
            <JsonLd {...args} />
            <div className="mt-4 p-4 bg-muted rounded">
                <p className="text-sm font-semibold mb-2">Product Schema with Reviews</p>
                <p className="text-xs text-muted-foreground">
                    This example includes product reviews in the structured data.
                </p>
            </div>
        </div>
    ),
};

export const ItemListSchema: Story = {
    args: {
        data: {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Electronics Category',
            description: 'Browse our selection of electronics products',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    item: {
                        '@type': 'Product',
                        name: 'Wireless Headphones',
                        url: '/products/wireless-headphones',
                    },
                },
                {
                    '@type': 'ListItem',
                    position: 2,
                    item: {
                        '@type': 'Product',
                        name: 'Smart Watch',
                        url: '/products/smart-watch',
                    },
                },
                {
                    '@type': 'ListItem',
                    position: 3,
                    item: {
                        '@type': 'Product',
                        name: 'Bluetooth Speaker',
                        url: '/products/bluetooth-speaker',
                    },
                },
            ],
        },
        id: 'itemlist-schema',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const script = canvasElement.querySelector('script[type="application/ld+json"]');
        await expect(script).toBeInTheDocument();
        if (script) {
            const jsonContent = JSON.parse(script.textContent || '{}');
            await expect(jsonContent['@type']).toBe('ItemList');
            await expect(Array.isArray(jsonContent.itemListElement)).toBe(true);
            await expect(jsonContent.itemListElement.length).toBe(3);
        }
    },
    render: (args) => (
        <div>
            <JsonLd {...args} />
            <div className="mt-4 p-4 bg-muted rounded">
                <p className="text-sm font-semibold mb-2">ItemList Schema (PLP use case)</p>
                <p className="text-xs text-muted-foreground">
                    This example shows how to structure a product listing page with multiple items.
                </p>
            </div>
        </div>
    ),
};

export const WithoutId: Story = {
    args: {
        data: {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Simple Product',
            description: 'A simple product without an id attribute',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const script = canvasElement.querySelector('script[type="application/ld+json"]');
        await expect(script).toBeInTheDocument();
        await expect(script?.hasAttribute('id')).toBe(false);
        if (script) {
            const jsonContent = JSON.parse(script.textContent || '{}');
            await expect(jsonContent['@type']).toBe('Product');
        }
    },
    render: (args) => (
        <div>
            <JsonLd {...args} />
            <div className="mt-4 p-4 bg-muted rounded">
                <p className="text-sm font-semibold mb-2">JSON-LD without ID</p>
                <p className="text-xs text-muted-foreground">The script tag is rendered without an id attribute.</p>
            </div>
        </div>
    ),
};

export const MultipleJsonLdScripts: Story = {
    render: () => (
        <div>
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Product',
                    name: 'Product 1',
                }}
                id="product-1"
            />
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Product',
                    name: 'Product 2',
                }}
                id="product-2"
            />
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        {
                            '@type': 'ListItem',
                            position: 1,
                            name: 'Home',
                            item: '/',
                        },
                        {
                            '@type': 'ListItem',
                            position: 2,
                            name: 'Products',
                            item: '/products',
                        },
                    ],
                }}
                id="breadcrumb-schema"
            />
            <div className="mt-4 p-4 bg-muted rounded">
                <p className="text-sm font-semibold mb-2">Multiple JSON-LD Scripts</p>
                <p className="text-xs text-muted-foreground">
                    Multiple JSON-LD scripts can be rendered on the same page, each with a unique id.
                </p>
            </div>
        </div>
    ),
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const scripts = canvasElement.querySelectorAll('script[type="application/ld+json"]');
        await expect(scripts.length).toBe(3);
        const product1 = canvasElement.querySelector('#product-1');
        const product2 = canvasElement.querySelector('#product-2');
        const breadcrumb = canvasElement.querySelector('#breadcrumb-schema');
        await expect(product1).toBeInTheDocument();
        await expect(product2).toBeInTheDocument();
        await expect(breadcrumb).toBeInTheDocument();
    },
};

export const ComplexNestedData: Story = {
    args: {
        data: {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Complex Product',
            description: 'A product with complex nested data structures',
            brand: {
                '@type': 'Brand',
                name: 'Example Brand',
            },
            manufacturer: {
                '@type': 'Organization',
                name: 'Example Manufacturer',
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: '123 Main St',
                    addressLocality: 'San Francisco',
                    addressRegion: 'CA',
                    postalCode: '94105',
                    addressCountry: 'US',
                },
            },
            offers: {
                '@type': 'AggregateOffer',
                offerCount: 3,
                lowPrice: '19.99',
                highPrice: '49.99',
                priceCurrency: 'USD',
                offers: [
                    {
                        '@type': 'Offer',
                        price: '19.99',
                        priceCurrency: 'USD',
                        availability: 'https://schema.org/InStock',
                    },
                    {
                        '@type': 'Offer',
                        price: '29.99',
                        priceCurrency: 'USD',
                        availability: 'https://schema.org/InStock',
                    },
                ],
            },
        },
        id: 'complex-schema',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const script = canvasElement.querySelector('script[type="application/ld+json"]');
        await expect(script).toBeInTheDocument();
        if (script) {
            const jsonContent = JSON.parse(script.textContent || '{}');
            await expect(jsonContent['@type']).toBe('Product');
            await expect(jsonContent.brand['@type']).toBe('Brand');
            await expect(jsonContent.manufacturer['@type']).toBe('Organization');
            await expect(Array.isArray(jsonContent.offers.offers)).toBe(true);
        }
    },
    render: (args) => (
        <div>
            <JsonLd {...args} />
            <div className="mt-4 p-4 bg-muted rounded">
                <p className="text-sm font-semibold mb-2">Complex Nested Data</p>
                <p className="text-xs text-muted-foreground">
                    This example demonstrates handling of deeply nested JSON-LD structures.
                </p>
            </div>
        </div>
    ),
};
