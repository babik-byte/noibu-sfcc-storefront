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
import { ShopperAgentWindow } from '../shopper-agent-window';
import { mockAltSiteObject } from '@/test-utils/config';

const mockConfig: ShopperAgentConfig = {
    enabled: 'true',
    embeddedServiceName: 'EmbeddedService',
    embeddedServiceEndpoint: 'https://example.salesforce.com/embedded',
    scriptSourceUrl: 'https://example.salesforce.com/embedded/script.js',
    scrt2Url: 'https://example.salesforce-scrt.com/scrt2',
    salesforceOrgId: '00D000000000000EAA',
    siteId: mockAltSiteObject.id,
};

const meta: Meta<typeof ShopperAgentWindow> = {
    title: 'Components/Shopper Agent/Shopper Agent Window',
    component: ShopperAgentWindow,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: `
Internal component that manages the Salesforce Embedded Messaging window lifecycle (script loading, init, prechat, context).
It does not render visible UI; it mounts the embedded service. In Storybook the external script is not loaded.
                `,
            },
        },
    },
    argTypes: {
        config: { control: false },
        domainUrl: { control: 'text' },
        locale: { control: 'text' },
        currency: { control: 'text' },
        siteId: { control: 'text' },
        userId: { control: 'text' },
        usid: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof ShopperAgentWindow>;

export const Default: Story = {
    args: {
        config: mockConfig,
        locale: mockAltSiteObject.defaultLocale,
        currency: mockAltSiteObject.defaultCurrency,
        siteId: mockAltSiteObject.id,
        domainUrl: 'https://example.com/',
    },
};

export const WithUserId: Story = {
    args: {
        config: mockConfig,
        locale: mockAltSiteObject.defaultLocale,
        currency: mockAltSiteObject.defaultCurrency,
        siteId: mockAltSiteObject.id,
        domainUrl: 'https://example.com/',
        userId: 'user-123',
    },
};

export const WithUsid: Story = {
    args: {
        config: mockConfig,
        locale: mockAltSiteObject.defaultLocale,
        currency: mockAltSiteObject.defaultCurrency,
        siteId: mockAltSiteObject.id,
        domainUrl: 'https://example.com/',
        usid: 'usid-abc-123',
    },
};
