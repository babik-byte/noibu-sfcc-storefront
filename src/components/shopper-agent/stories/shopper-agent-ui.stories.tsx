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
import type { ShopperAgentConfig } from '../shopper-agent.utils';
import ShopperAgentUI from '../shopper-agent-ui';
import { mockAltSiteObject, mockSiteObject } from '@/test-utils/config';

const validConfig: ShopperAgentConfig = {
    enabled: 'true',
    embeddedServiceName: 'EmbeddedService',
    embeddedServiceEndpoint: 'https://example.salesforce.com/embedded',
    scriptSourceUrl: 'https://example.salesforce.com/embedded/script.js',
    scrt2Url: 'https://example.salesforce-scrt.com/scrt2',
    salesforceOrgId: '00D000000000000EAA',
    siteId: mockSiteObject.id,
};

const meta: Meta<typeof ShopperAgentUI> = {
    title: 'Components/Shopper Agent/Shopper Agent UI',
    component: ShopperAgentUI,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: `
Shopper Agent UI chunk – loads Embedded Messaging script and mounts the chat window.
When configuration is invalid, renders null. In Storybook the embedded script is not loaded, so only the wrapper div is visible.
                `,
            },
        },
    },
    argTypes: {
        commerceAgentConfiguration: { control: false },
        locale: { control: 'text' },
        currency: { control: 'text' },
        userId: { control: 'text' },
        usid: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof ShopperAgentUI>;

export const WithValidConfig: Story = {
    args: {
        commerceAgentConfiguration: validConfig,
        locale: mockAltSiteObject.defaultLocale,
        currency: mockAltSiteObject.defaultCurrency,
    },
    parameters: {
        docs: {
            description: {
                story: 'Shopper Agent UI with valid config. Renders wrapper; embedded chat loads in real app only.',
            },
        },
    },
};

export const InvalidConfig: Story = {
    args: {
        commerceAgentConfiguration: undefined,
        locale: mockAltSiteObject.defaultLocale,
    },
    parameters: {
        docs: {
            description: {
                story: 'When configuration is missing or invalid, the component renders nothing (null).',
            },
        },
    },
};

export const WithUserId: Story = {
    args: {
        commerceAgentConfiguration: validConfig,
        locale: mockAltSiteObject.defaultLocale,
        currency: mockAltSiteObject.defaultCurrency,
        userId: 'user-123',
    },
};

export const WithUsid: Story = {
    args: {
        commerceAgentConfiguration: validConfig,
        locale: mockAltSiteObject.defaultLocale,
        currency: mockAltSiteObject.defaultCurrency,
        usid: 'usid-abc-123',
    },
};
