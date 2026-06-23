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
import ProductRecommendations from '..';
import { mockStandardProductHit } from '../../__mocks__/product-search-hit-data';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { mockConfig, mockLocale, mockSiteObject } from '@/test-utils/config';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';

const meta: Meta<typeof ProductRecommendations> = {
    title: 'Components/ProductRecommendations',
    component: ProductRecommendations,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: `
The ProductRecommendations component displays product recommendation carousels using Einstein.

**Features:**
- Fetches recommendations from Einstein via the recommenders adapter
- Supports both recommender and zone types
- Handles loading states with skeleton UI
- Gracefully handles empty states and errors
- Integrates with ProductCarousel for display

**Note:** In Storybook, the component fetches from the BFF route (/resource/recommendations); without
a backing handler the carousel may render in its loading or empty state.
                `,
            },
        },
    },
    decorators: [
        (Story) => (
            <ConfigProvider config={mockConfig}>
                <SiteProvider
                    site={mockSiteObject}
                    locale={mockLocale}
                    language={mockSiteObject.defaultLocale}
                    currency={mockSiteObject.defaultCurrency}>
                    <div className="p-8">
                        <Story />
                    </div>
                </SiteProvider>
            </ConfigProvider>
        ),
    ],
    argTypes: {
        recommender: {
            description: 'Recommender configuration `{ name, title, type? }` — primary entry point',
            control: false,
        },
        recommenderName: {
            description: 'Page-Designer-friendly individual prop — alternative to `recommender.name`',
            control: 'text',
        },
        recommenderTitle: {
            description: 'Page-Designer-friendly individual prop — alternative to `recommender.title`',
            control: 'text',
        },
        recommenderType: {
            description: 'Page-Designer-friendly individual prop — `recommender` (default) or `zone`',
            control: 'select',
            options: ['recommender', 'zone'],
        },
        titleClassName: {
            description: 'Optional `className` for the carousel title (e.g. smaller text on account overview)',
            control: 'text',
        },
        subtitle: {
            description: 'Optional subtitle displayed below the carousel title',
            control: 'text',
        },
        shopAllText: {
            description: 'Optional header link text (no URL — plain text only)',
            control: 'text',
        },
        className: {
            description: 'Optional `className` applied to the carousel wrapper',
            control: 'text',
        },
        products: {
            description: 'Optional product list — falls back to `useProduct()` context if omitted',
            control: false,
        },
        args: {
            description: 'Optional Einstein recommender arguments (e.g. `{ maxResults, categoryId }`)',
            control: false,
        },
    },
};

export default meta;
type Story = StoryObj<typeof ProductRecommendations>;

// No play functions: in Storybook the Einstein adapter never resolves (no real
// HTTP fetch wired), so the component returns null. Snapshot + a11y coverage is
// enough — adding presence-only plays would silently pass on the null render
// (Pattern 6).

/**
 * Rich-but-realistic baseline. The Controls panel exposes every leaf prop —
 * `recommenderName`, `recommenderTitle`, `recommenderType`, `subtitle`,
 * `shopAllText`, `titleClassName`, `className`. The `recommender` object,
 * `products`, and `args` stay as fixtures (composite types). Toggle the text
 * controls to see the loading skeleton title update live.
 */
export const Playground: Story = {
    args: {
        recommender: {
            name: 'pdp-similar-items',
            title: 'You May Also Like',
            type: 'recommender',
        },
        subtitle: 'Hand-picked for you',
        shopAllText: 'Shop All',
    },
};

export const Default: Story = {
    args: {
        recommender: {
            name: 'pdp-similar-items',
            title: 'You May Also Like',
            type: 'recommender',
        },
    },
};

export const ZoneType: Story = {
    args: {
        recommender: {
            name: 'pdp-zone',
            title: 'Featured Products',
            type: 'zone',
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates `type: "zone"` — uses `getZoneRecommendations` instead of `getRecommendations`. Distinct fetch path inside the component.',
            },
        },
    },
};

export const WithProducts: Story = {
    args: {
        recommender: {
            name: 'pdp-similar-items',
            title: 'You May Also Like',
            type: 'recommender',
        },
        products: [
            {
                ...mockStandardProductHit,
                productId: 'current-product',
            },
        ],
    },
    parameters: {
        docs: {
            description: {
                story: 'Explicit `products` prop bypasses `useProduct()` context — used when the component lives outside a PDP.',
            },
        },
    },
};

export const WithArgs: Story = {
    args: {
        recommender: {
            name: 'pdp-similar-items',
            title: 'You May Also Like',
            type: 'recommender',
        },
        args: {
            maxResults: 10,
            categoryId: 'mens-clothing',
        },
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates passing Einstein recommender `args` (e.g. `maxResults`, `categoryId`).',
            },
        },
    },
};
