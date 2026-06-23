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
import { AiInsightCard } from '..';

const meta: Meta<typeof AiInsightCard> = {
    title: 'Components/AiInsightCard/Index',
    component: AiInsightCard,
    tags: ['autodocs'],
    parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof AiInsightCard>;

export const Default: Story = {
    args: {
        variant: 'review',
        title: 'AI Review Summary',
        description: 'Customers love the quality and comfort of this product.',
        rating: 4.5,
        reviewCount: 100,
    },
};
