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
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { allModes } from '../../../../../.storybook/modes';
import { AccountHelp } from '../index';
import { mockBuildConfig, mockSiteObject } from '@/test-utils/config';

// Need Help card always mounts; Ask a question only renders when shopper-agent
// config is valid and the context-UI gate is on. This story config supplies a
// well-formed agent configuration so all three buttons render.
const accountHelpStoryConfig = {
    ...mockBuildConfig.app,
    commerceAgent: {
        enabled: true,
        embeddedServiceName: 'test_agent',
        embeddedServiceEndpoint: 'https://test.my.salesforce.com/embeddedservice/6.0/test',
        scriptSourceUrl: 'https://test.my.salesforce.com/embeddedservice/6.0/esw.min.js',
        scrt2Url: 'https://test.salesforce-scrt.com',
        salesforceOrgId: '00D000000000000EAA',
        siteId: mockSiteObject.id,
    },
};

const meta: Meta<typeof AccountHelp> = {
    title: 'ACCOUNT/Account Help',
    component: AccountHelp,
    tags: ['autodocs', 'interaction'],
    parameters: {
        chromatic: { modes: { desktop: allModes.desktop } },
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Account-overview help card. Always renders Contact info and Browse FAQ; the primary "Ask a question" button only renders when shopper-agent config is valid and `isShopperAgentContextUiEnabled` is on.',
            },
        },
    },
    decorators: [
        (Story) => (
            <ConfigProvider config={accountHelpStoryConfig}>
                <div className="p-8 max-w-2xl">
                    <Story />
                </div>
            </ConfigProvider>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        await expect(canvas.getByText('Need Help?')).toBeInTheDocument();
        await expect(canvas.getByRole('button', { name: /Ask a question/i })).toBeInTheDocument();
        await expect(canvas.getByRole('button', { name: /Contact info/i })).toBeInTheDocument();
        await expect(canvas.getByRole('button', { name: /Browse FAQ/i })).toBeInTheDocument();
    },
};
