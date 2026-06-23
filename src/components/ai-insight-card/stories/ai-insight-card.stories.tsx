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
import { AiInsightCard } from '../ai-insight-card';

const meta: Meta<typeof AiInsightCard> = {
    title: 'Components/AiInsightCard',
    component: AiInsightCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: `
AiInsightCard has two variants: variant="review" for AI review summary (with rating) in the Customer Reviews section;
variant="shoppingAssistant" for the shopper agent card on the search page (dark card, optional onActionClick).
                `,
            },
        },
    },
    argTypes: {
        variant: { control: 'select', options: ['review', 'shoppingAssistant'] },
        title: { control: 'text' },
        badgeText: { control: 'text' },
        description: { control: 'text' },
        rating: { control: { type: 'number', min: 0, max: 5, step: 0.1 } },
        reviewCount: { control: { type: 'number', min: 0 } },
    },
};

export default meta;

type Story = StoryObj<typeof AiInsightCard>;

export const ReviewDefault: Story = {
    args: {
        variant: 'review',
        title: 'AI Review Summary',
        badgeText: 'Beta',
        description:
            'Customers love the comfort and fit of these shoes. Many mention they run true to size and are great for all-day wear. The style and quality receive consistent praise.',
        rating: 4.5,
        reviewCount: 128,
    },
};

export const ReviewShortSummary: Story = {
    args: {
        variant: 'review',
        title: 'AI Review Summary',
        badgeText: 'Beta',
        description: 'Highly rated for comfort and durability.',
        rating: 4.8,
        reviewCount: 42,
    },
};

export const ReviewNoBadge: Story = {
    args: {
        variant: 'review',
        title: 'AI Review Summary',
        description: 'Summary without a badge.',
        rating: 4,
        reviewCount: 10,
    },
};

export const ShoppingAssistant: Story = {
    args: {
        variant: 'shoppingAssistant',
        title: 'Shop with your Personal Assistant',
        description: 'I can help you find the perfect piece for your space. Shop with me.',
        onActionClick: () => {},
    },
};

export const ShoppingAssistantNonClickable: Story = {
    args: {
        variant: 'shoppingAssistant',
        title: 'Shop with your Personal Assistant',
        description: 'I can help you find the perfect piece for your space. Shop with me.',
    },
};
