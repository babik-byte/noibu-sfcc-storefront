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
import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { ConfigWrapper, mockLocale, mockSiteObject } from '@/test-utils/config';
import { CarouselItem } from '@/components/ui/carousel';
import { CarouselSection } from '../index';

const mockSite = mockSiteObject;

function DemoSlides(): ReactElement {
    return (
        <>
            {[1, 2, 3, 4].map((i) => (
                <CarouselItem key={i} className="basis-1/2 pl-4 sm:basis-1/3 md:basis-1/4">
                    <div className="flex h-28 min-w-0 items-center justify-center rounded-none border border-border bg-muted text-sm">
                        Slide {i}
                    </div>
                </CarouselItem>
            ))}
        </>
    );
}

const meta: Meta<typeof CarouselSection> = {
    title: 'Components/CarouselSection',
    component: CarouselSection,
    tags: ['autodocs', 'skip-a11y'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Shared carousel shell: section padding, title row (left or center), Embla track, and previous/next controls. Children should be `CarouselItem` elements.',
            },
        },
    },
    decorators: [
        (Story) => (
            <MemoryRouter>
                <ConfigWrapper>
                    <SiteProvider
                        site={mockSite}
                        locale={mockLocale}
                        language={mockSiteObject.defaultLocale}
                        currency={mockSiteObject.defaultCurrency}>
                        <Story />
                    </SiteProvider>
                </ConfigWrapper>
            </MemoryRouter>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof CarouselSection>;

export const LeftTitleWithShopAll: Story = {
    render: () => (
        <CarouselSection
            title="Featured"
            subtitle="Hand-picked for you"
            shopAllUrl="/category/root"
            shopAllText="Shop all"
            ariaLabel="Featured carousel">
            <DemoSlides />
        </CarouselSection>
    ),
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: /featured/i })).toBeInTheDocument();
        await expect(canvas.getByRole('link', { name: /shop all/i })).toBeInTheDocument();
    },
};

export const CenterTitleWithSubtitle: Story = {
    render: () => (
        <CarouselSection
            title="Shop by category"
            subtitle="Explore our collections"
            titleAlign="center"
            ariaLabel="Categories carousel">
            <DemoSlides />
        </CarouselSection>
    ),
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('heading', { name: /shop by category/i })).toBeInTheDocument();
    },
};

export const ShopAllLabelWithoutLink: Story = {
    render: () => (
        <CarouselSection title="New arrivals" shopAllText="View all" ariaLabel="New arrivals carousel">
            <DemoSlides />
        </CarouselSection>
    ),
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText(/view all/i)).toBeInTheDocument();
    },
};

export const CarouselOnly: Story = {
    render: () => (
        <CarouselSection ariaLabel="Demo carousel">
            <DemoSlides />
        </CarouselSection>
    ),
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByLabelText(/demo carousel/i)).toBeInTheDocument();
    },
};
