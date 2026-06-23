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
import HtmlFragment from '..';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';

const meta: Meta<typeof HtmlFragment> = {
    title: 'Components/HtmlFragment',
    component: HtmlFragment,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
    },
};

export default meta;
type Story = StoryObj<typeof HtmlFragment>;

export const PlainText: Story = {
    args: {
        content: 'This is a premium quality product with excellent durability and comfort.',
        contentType: 'plain-text',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(
            canvas.getByText('This is a premium quality product with excellent durability and comfort.')
        ).toBeInTheDocument();
    },
};

export const BulletedList: Story = {
    args: {
        content: '<ul><li>Premium cotton blend</li><li>Machine washable</li><li>Breathable fabric</li></ul>',
        contentType: 'bulleted-list',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Premium cotton blend')).toBeInTheDocument();
        await expect(canvas.getByText('Machine washable')).toBeInTheDocument();
    },
};

export const Table2Column: Story = {
    args: {
        content:
            '<table><tr><td>Material:</td><td>Full-grain leather</td></tr><tr><td>Sole:</td><td>Rubber</td></tr><tr><td>Heel height:</td><td>1.5"</td></tr><tr><td>Closure:</td><td>Lace-up + side zip</td></tr></table>',
        contentType: 'table-2-column',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Material:')).toBeInTheDocument();
        await expect(canvas.getByText('Full-grain leather')).toBeInTheDocument();
    },
};
