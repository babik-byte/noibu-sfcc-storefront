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
import { createMemoryRouter, RouterProvider, useInRouterContext } from 'react-router';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';
import { mockAltSiteObject, mockBuildConfig, mockSiteObject } from '@/test-utils/config';
import Faq from '../index';
import type { ReactElement } from 'react';

/** FAQ only mounts when shopper agent is enabled and passes validation (matches unit test fixtures). */
const faqStoryConfig = {
    ...mockBuildConfig.app,
    commerceAgent: {
        enabled: 'true' as const,
        embeddedServiceName: 'storybook_service',
        embeddedServiceEndpoint: 'https://test.my.site.com/ESWtest',
        scriptSourceUrl: 'https://test.my.site.com/ESWtest/assets/js/bootstrap.min.js',
        scrt2Url: 'https://test.salesforce-scrt.com',
        salesforceOrgId: '00Dxx0000000000',
        siteId: mockAltSiteObject.id,
    },
};

const mockQuestions = [
    'What sizes does this come in?',
    'Which color would work best for a minimalist space?',
    'Will this work in a minimalist living room?',
];

function FaqWrapper(): ReactElement {
    const inRouter = useInRouterContext();
    const content = (
        <ConfigProvider config={faqStoryConfig}>
            <SiteProvider
                site={faqStoryConfig.commerce.sites[0]}
                locale={faqStoryConfig.commerce.sites[0].supportedLocales[0]}
                language={mockSiteObject.defaultLocale}
                currency={mockSiteObject.defaultCurrency}>
                <div className="max-w-md p-6">
                    <Faq questions={mockQuestions} />
                </div>
            </SiteProvider>
        </ConfigProvider>
    );

    if (inRouter) {
        return content;
    }

    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: content,
            },
        ],
        { initialEntries: ['/'] }
    );

    return <RouterProvider router={router} />;
}

const meta: Meta<typeof FaqWrapper> = {
    title: 'Extensions/ProductContent/Faq',
    component: FaqWrapper,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    },
};

export default meta;
type Story = StoryObj<typeof FaqWrapper>;

export const Default: Story = {
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const heading = await canvas.findByText('Ask assistant', {}, { timeout: 5000 });
        await expect(heading).toBeInTheDocument();
        await expect(canvas.getByText('AI')).toBeInTheDocument();
        await expect(canvas.getByText('What sizes does this come in?')).toBeInTheDocument();
        await expect(canvas.getByText('Which color would work best for a minimalist space?')).toBeInTheDocument();
        await expect(canvas.getByText('Will this work in a minimalist living room?')).toBeInTheDocument();
    },
};
