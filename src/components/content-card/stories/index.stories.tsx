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
import ContentCard from '../index';
import { action } from 'storybook/actions';
import { useEffect, useRef, type ReactNode, type ReactElement } from 'react';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';

function ContentCardStoryHarness({ children }: { children: ReactNode }): ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const root = containerRef.current;
        if (!root) return;

        const logClick = action('content-card-click');
        const logHover = action('content-card-hover');

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target || !root.contains(target)) return;
            const link = target.closest('a');
            if (link) {
                event.preventDefault();
                event.stopPropagation();
                logClick({ href: link.getAttribute('href') || '', text: link.textContent?.trim() || '' });
            }
        };

        const handleMouseOver = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target || !root.contains(target)) return;
            logHover({ element: target.textContent?.trim() || '' });
        };

        root.addEventListener('click', handleClick);
        root.addEventListener('mouseover', handleMouseOver);
        return () => {
            root.removeEventListener('click', handleClick);
            root.removeEventListener('mouseover', handleMouseOver);
        };
    }, []);

    return <div ref={containerRef}>{children}</div>;
}

const meta: Meta<typeof ContentCard> = {
    title: 'COMMON/Content Card',
    component: ContentCard,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: `
A flexible card component for displaying content with optional image, title, description, and call-to-action button.

### Features:
- Optional image with lazy loading
- Title and description text
- Call-to-action button with link
- Configurable background and border
- Responsive design
                `,
            },
        },
    },
    decorators: [
        (Story) => (
            <ContentCardStoryHarness>
                <Story />
            </ContentCardStoryHarness>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof ContentCard>;

export const Default: Story = {
    render: () => (
        <ContentCard
            title="Featured Product"
            description="Discover our latest collection of premium products designed for modern living."
            imageUrl="https://via.placeholder.com/400x300"
            imageAlt="Featured Product"
            buttonText="Shop Now"
            buttonLink="/category/featured"
        />
    ),
    parameters: {
        docs: {
            description: {
                story: `
Standard content card with all features enabled.

### Features:
- Image with alt text
- Title and description
- Call-to-action button
- Background and border enabled
            `,
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for title
        const title = await canvas.findByText(/featured product/i, {}, { timeout: 5000 });
        await expect(title).toBeInTheDocument();

        // Check for description
        const description = await canvas.findByText(/discover our latest/i, {}, { timeout: 5000 });
        await expect(description).toBeInTheDocument();

        // Check for button
        const button = await canvas.findByRole('link', { name: /shop now/i }, { timeout: 5000 });
        await expect(button).toBeInTheDocument();
    },
};

export const WithoutButton: Story = {
    render: () => (
        <ContentCard
            title="Text Only Card"
            description="This card has an image with text overlay but no button."
            imageUrl="https://via.placeholder.com/400x300"
            imageAlt="Text only card"
        />
    ),
    parameters: {
        docs: {
            description: {
                story: `
Content card without a button.

### Features:
- Image with text overlay
- No call-to-action button
            `,
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for title
        const title = await canvas.findByText(/text only card/i, {}, { timeout: 5000 });
        await expect(title).toBeInTheDocument();
    },
};

export const Minimal: Story = {
    render: () => (
        <ContentCard
            title="Minimal Card"
            description="A simple card with image and text overlay."
            imageUrl="https://via.placeholder.com/400x300"
            imageAlt="Minimal card"
        />
    ),
    parameters: {
        docs: {
            description: {
                story: `
Minimal content card with image and text overlay.

### Features:
- Image with text overlay
- No button
            `,
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for title
        const title = await canvas.findByText(/minimal card/i, {}, { timeout: 5000 });
        await expect(title).toBeInTheDocument();
    },
};

export const NoBackground: Story = {
    render: () => (
        <ContentCard
            title="Transparent Card"
            description="This card has no background or border for a cleaner look."
            imageUrl="https://via.placeholder.com/400x300"
            imageAlt="Transparent card"
            showBackground={false}
            showBorder={false}
            buttonText="Explore"
            buttonLink="/explore"
        />
    ),
    parameters: {
        docs: {
            description: {
                story: `
Content card with transparent background and no border.

### Features:
- No background
- No border
- Clean, minimal appearance
            `,
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for title
        const title = await canvas.findByText(/transparent card/i, {}, { timeout: 5000 });
        await expect(title).toBeInTheDocument();
    },
};

export const CustomClassNames: Story = {
    render: () => (
        <ContentCard
            title="Custom Class Names"
            description="This example applies custom classes to the footer, description, and button."
            imageUrl="https://via.placeholder.com/400x300"
            imageAlt="Custom class names"
            buttonText="View Details"
            buttonLink="/details"
            className="flex-row"
            cardFooterClassName="flex-row items-center"
            cardDescriptionClassName="flex-none"
            buttonClassName="w-fit"
        />
    ),
    parameters: {
        docs: {
            description: {
                story: `
Content card with customized footer, description, and button class names.

### Features:
- Custom footer and description alignment
- Custom button width
            `,
            },
        },
    },
};
