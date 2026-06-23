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
import { createPage } from '../index';
import { action } from 'storybook/actions';
import { useEffect, useRef, type ReactNode, type ReactElement } from 'react';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';

function CreatePageStoryHarness({ children }: { children: ReactNode }): ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const root = containerRef.current;
        if (!root) return;

        const logRender = action('create-page-render');
        logRender({ component: 'PageComponent' });
    }, []);

    return <div ref={containerRef}>{children}</div>;
}

// Example component to use with createPage
function ExamplePageComponent({ loaderData }: { loaderData?: { title: string; content: string } }) {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">{loaderData?.title || 'Default Title'}</h1>
            <p className="text-muted-foreground">{loaderData?.content || 'Default content'}</p>
        </div>
    );
}

const ExamplePage = createPage({
    component: ExamplePageComponent,
    fallback: <div className="p-6">Loading...</div>,
});

const ExamplePageWithKey = createPage({
    component: ExamplePageComponent,
    fallback: <div className="p-6">Loading...</div>,
    getPageKey: (data) => data?.title || 'default',
});

const meta: Meta<typeof ExamplePage> = {
    title: 'COMMON/Create Page',
    component: ExamplePage,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: `
A higher-order component factory that creates page components with Suspense boundaries and page key handling.

### Features:
- Automatic Suspense wrapping
- Custom fallback components
- Page key generation for navigation transitions
- Promise resolution support
                `,
            },
        },
    },
    decorators: [
        (Story) => (
            <CreatePageStoryHarness>
                <Story />
            </CreatePageStoryHarness>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof ExamplePage>;

export const Default: Story = {
    render: () => (
        <ExamplePage
            loaderData={{ title: 'Example Page', content: 'This is an example page created with createPage.' }}
        />
    ),
    parameters: {
        docs: {
            story: `
Basic page created with createPage HOC.

### Features:
- Suspense boundary
- Default fallback
- Loader data passed to component
            `,
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for title - use findByRole for h1 to avoid multiple matches
        const title = await canvas.findByRole('heading', { name: /example page/i }, { timeout: 5000 });
        await expect(title).toBeInTheDocument();
    },
};

export const WithPageKey: Story = {
    render: () => (
        <ExamplePageWithKey
            loaderData={{ title: 'Page With Key', content: 'This page uses a custom page key function.' }}
        />
    ),
    parameters: {
        docs: {
            story: `
Page created with createPage using a custom page key function.

### Features:
- Custom page key generation
- Fragment wrapping with key
- Navigation transition support
            `,
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for title
        const title = await canvas.findByText(/page with key/i, {}, { timeout: 5000 });
        await expect(title).toBeInTheDocument();
    },
};

export const WithCustomFallback: Story = {
    render: () => {
        const CustomPage = createPage({
            component: ExamplePageComponent,
            fallback: <div className="p-6 bg-muted rounded">Custom loading state...</div>,
        });
        return (
            <CustomPage
                loaderData={{ title: 'Custom Fallback', content: 'This page uses a custom fallback component.' }}
            />
        );
    },
    parameters: {
        docs: {
            story: `
Page created with createPage using a custom fallback component.

### Features:
- Custom fallback UI
- Better loading experience
            `,
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for title - use findByRole for h1 to avoid multiple matches
        const title = await canvas.findByRole('heading', { name: /custom fallback/i }, { timeout: 5000 });
        await expect(title).toBeInTheDocument();
    },
};
