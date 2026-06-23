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
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { PasswordRequirement } from '@/components/password-requirements';

const meta: Meta<typeof PasswordRequirement> = {
    title: 'AUTHENTICATION/Password Requirements',
    component: PasswordRequirement,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Real-time password rule checklist. Each of the 5 rules (length 8+, uppercase, lowercase, digit, special char) renders with a check or X based on the live `password` value.',
            },
        },
    },
    argTypes: {
        password: {
            control: 'text',
            description: 'The password string evaluated against the 5 built-in rules.',
        },
    },
    args: {
        password: '',
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-md p-6 bg-background border rounded-none">
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
    args: { password: '' },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        await expect(canvas.getAllByTestId('x-icon')).toHaveLength(5);
        await expect(canvas.queryByTestId('check-icon')).toBeNull();
    },
};

export const Partial: Story = {
    args: { password: 'lower1' },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        // lowercase + number → 2 met, length / uppercase / special → 3 unmet
        await expect(canvas.getAllByTestId('check-icon')).toHaveLength(2);
        await expect(canvas.getAllByTestId('x-icon')).toHaveLength(3);
    },
};

export const AllMet: Story = {
    args: { password: 'SecurePass123!' },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        await expect(canvas.getAllByTestId('check-icon')).toHaveLength(5);
        await expect(canvas.queryByTestId('x-icon')).toBeNull();
    },
};
