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
import { expect } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { action } from 'storybook/actions';
import HeroCarouselSkeleton from '../skeleton';

function ActionLogger({ children }: { children: ReactNode }): ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const root = containerRef.current;
        if (!root) return;

        const logClick = action('interaction');

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target || !root.contains(target)) return;

            const button = target.closest('button, [role="button"]');
            if (button) {
                const label = button.textContent?.trim() || button.getAttribute('aria-label') || '';
                logClick({ type: 'click', element: 'button', label });
            }
        };

        root.addEventListener('click', handleClick, true);

        return () => {
            root.removeEventListener('click', handleClick, true);
        };
    }, []);

    return <div ref={containerRef}>{children}</div>;
}

const meta: Meta<typeof HeroCarouselSkeleton> = {
    title: 'COMMON/HeroCarouselSkeleton',
    component: HeroCarouselSkeleton,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: `
HeroCarouselSkeleton component provides a loading state placeholder for hero carousels.

## Features

- **Loading State**: Skeleton UI that mimics hero carousel layout
- **Configurable**: Supports custom slide count, dots, and navigation visibility
- **Responsive**: Adapts to different screen sizes
- **Accessibility**: Includes screen reader text

## Usage

This component is used as a fallback while hero carousel data is being fetched, providing visual feedback during loading states.
                `,
            },
        },
    },
    decorators: [
        (Story: React.ComponentType) => (
            <ActionLogger>
                <Story />
            </ActionLogger>
        ),
    ],
    argTypes: {
        slideCount: {
            description: 'Number of slides to show in dots',
            control: { type: 'number', min: 1, max: 10 },
        },
        showDots: {
            description: 'Whether to show navigation dots skeleton',
            control: 'boolean',
        },
        showNavigation: {
            description: 'Whether to show navigation controls skeleton',
            control: 'boolean',
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    parameters: {
        docs: {
            description: {
                story: `
Default hero carousel skeleton showing:
- Full-width hero image skeleton
- Content overlay with title and subtitle skeletons
- CTA button skeleton
- Navigation dots skeleton (3 slides)
- Navigation controls skeleton

This is the standard loading state for hero carousels.
                `,
            },
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);

        // Verify skeleton structure is present
        const skeleton = canvasElement.querySelector('.animate-pulse');
        await expect(skeleton).toBeInTheDocument();

        // Verify navigation dots are present (default slideCount is 3)
        const dotsContainer = canvasElement.querySelector('.absolute.bottom-6');
        await expect(dotsContainer).toBeInTheDocument();
    },
};
