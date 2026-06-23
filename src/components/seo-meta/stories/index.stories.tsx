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
import { SeoMeta } from '../index';

const meta: Meta<typeof SeoMeta> = {
    title: 'Components/SEO Meta',
    component: SeoMeta,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Renders SEO `<title>` and `<meta>` tags using React 19 document metadata hoisting. Tags are automatically hoisted to `<head>` and work with streaming/Suspense. Note: Meta tags are not visible in the Storybook canvas but are present in the document head.',
            },
        },
    },
    argTypes: {
        title: { control: 'text' },
        rawTitle: { control: 'boolean' },
        description: { control: 'text' },
        noIndex: { control: 'boolean' },
        siteName: { control: 'text' },
        twitter: { control: 'object' },
    },
    decorators: [
        (Story) => (
            <div className="p-4 border rounded-none">
                <p className="text-sm text-muted-foreground mb-2">
                    Meta tags are rendered in the document head (not visible here)
                </p>
                <Story />
                <p className="text-sm text-muted-foreground mt-2">
                    Check the browser dev tools to inspect the meta tags
                </p>
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof SeoMeta>;

export const Default: Story = {
    args: {
        title: 'Classic Leather Jacket',
        description: 'Premium leather jacket with a tailored fit.',
    },
};

export const RawTitle: Story = {
    args: {
        rawTitle: true,
        title: 'NextGen PWA Kit Store',
        description: 'Your one-stop shop for premium fashion.',
    },
};

export const NoIndex: Story = {
    args: {
        title: 'Order History',
        description: 'View your past orders and order status.',
        noIndex: true,
    },
};

export const WithTwitterCard: Story = {
    args: {
        title: 'New Arrivals',
        description: 'Check out our latest collection.',
        twitter: {
            cardType: 'summary_large_image',
            image: 'https://via.placeholder.com/1200x630',
        },
    },
};

export const CustomSiteName: Story = {
    args: {
        title: 'About Us',
        description: 'Learn more about our company.',
        siteName: 'Custom Store Name',
    },
};

export const TitleOnly: Story = {
    args: {
        title: 'Contact Us',
    },
};

export const SiteNameOnly: Story = {
    args: {},
};
