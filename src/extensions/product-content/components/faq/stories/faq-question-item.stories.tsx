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
/** @sfdc-extension-file SFDC_EXT_PRODUCT_CONTENT */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import FaqQuestionItem from '../faq-question-item';

const meta: Meta<typeof FaqQuestionItem> = {
    title: 'Extensions/ProductContent/Faq/FaqQuestionItem',
    component: FaqQuestionItem,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    },
    argTypes: {
        question: { control: 'text' },
        onClick: { action: 'clicked' },
    },
};

export default meta;
type Story = StoryObj<typeof FaqQuestionItem>;

export const Default: Story = {
    args: {
        question: 'What sizes does this come in?',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('What sizes does this come in?')).toBeInTheDocument();
        await expect(canvas.getByRole('button')).toBeInTheDocument();
    },
};

export const SecondQuestion: Story = {
    args: {
        question: 'Which color would work best for a minimalist space?',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Which color would work best for a minimalist space?')).toBeInTheDocument();
    },
};

export const ThirdQuestion: Story = {
    args: {
        question: 'Will this work in a minimalist living room?',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Will this work in a minimalist living room?')).toBeInTheDocument();
    },
};
