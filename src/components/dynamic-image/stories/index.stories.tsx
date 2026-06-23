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
import { DynamicImage } from '../index';
import { action } from 'storybook/actions';
import { useEffect, useRef, type ReactNode, type ReactElement } from 'react';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { mockConfig } from '@/test-utils/config';

function DynamicImageStoryHarness({ children }: { children: ReactNode }): ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const root = containerRef.current;
        if (!root) return;

        const logLoad = action('dynamic-image-load');
        const logError = action('dynamic-image-error');

        const handleLoad = (event: Event) => {
            const img = event.target as HTMLImageElement;
            if (img && root.contains(img)) {
                logLoad({ src: img.src, alt: img.alt });
            }
        };

        const handleError = (event: Event) => {
            const img = event.target as HTMLImageElement;
            if (img && root.contains(img)) {
                logError({ src: img.src });
            }
        };

        root.addEventListener('load', handleLoad, true);
        root.addEventListener('error', handleError, true);
        return () => {
            root.removeEventListener('load', handleLoad, true);
            root.removeEventListener('error', handleError, true);
        };
    }, []);

    return <div ref={containerRef}>{children}</div>;
}

const meta: Meta<typeof DynamicImage> = {
    title: 'PAGE DESIGNER/Atomic/Image',
    component: DynamicImage,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: `
A responsive image component optimized for Dynamic Imaging Service with Page Designer support. Creates picture elements with responsive sources, preloading support, and customizable styling.

### Features:
- Responsive image widths
- Picture element with multiple sources
- Preloading for high-priority images
- Lazy loading support
- Page Designer styling props (objectFit, borderRadius, boxShadow, padding, margin, hoverEffect)
- Customizable image props
                `,
            },
        },
    },
    decorators: [
        (Story) => (
            <ConfigProvider config={mockConfig}>
                <DynamicImageStoryHarness>
                    <Story />
                </DynamicImageStoryHarness>
            </ConfigProvider>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof DynamicImage>;

export const Default: Story = {
    render: () => (
        <DynamicImage
            src="https://via.placeholder.com/800[?sw={width}&q=60]"
            alt="Example image"
            widths={[400, 800, 1200]}
        />
    ),
    parameters: {
        docs: {
            story: `
Standard dynamic image with responsive widths.

### Features:
- Array of widths
- Responsive picture element
- Lazy loading by default
            `,
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for image
        const image = await canvas.findByRole('img', { name: /example image/i }, { timeout: 5000 });
        await expect(image).toBeInTheDocument();
    },
};

export const WithObjectWidths: Story = {
    render: () => (
        <DynamicImage
            src="https://via.placeholder.com/800[?sw={width}&q=60]"
            alt="Object widths example"
            widths={{ base: 400, sm: 600, md: 800, lg: 1200 }}
        />
    ),
    parameters: {
        docs: {
            story: `
Dynamic image with object-based width configuration.

### Features:
- Breakpoint-based widths
- Responsive sources
            `,
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for image
        const image = await canvas.findByRole('img', { name: /object widths/i }, { timeout: 5000 });
        await expect(image).toBeInTheDocument();
    },
};

export const HighPriority: Story = {
    render: () => (
        <DynamicImage
            src="https://via.placeholder.com/800[?sw={width}&q=60]"
            alt="High priority image"
            widths={[400, 800, 1200]}
            priority="high"
            loading="eager"
        />
    ),
    parameters: {
        docs: {
            story: `
Dynamic image with high priority and eager loading.

### Features:
- High priority preloading
- Eager loading
- Optimized for above-the-fold content
            `,
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitForStorybookReady(canvasElement);

        // Check for image
        const image = await canvas.findByRole('img', { name: /high priority/i }, { timeout: 5000 });
        await expect(image).toBeInTheDocument();
    },
};

export const WithCustomComponent: Story = {
    render: () => (
        <DynamicImage
            src="https://via.placeholder.com/800[?sw={width}&q=60]"
            alt="Custom component example"
            widths={[400, 800]}
            as="div"
            className="bg-muted rounded-none p-4"
        />
    ),
    parameters: {
        docs: {
            story: `
Dynamic image using a custom element type.

### Features:
- Custom element (div instead of img)
- Custom className
            `,
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);

        // Check for picture element
        const picture = canvasElement.querySelector('picture');
        await expect(picture).toBeInTheDocument();
    },
};

// Page Designer Styling Props Stories

export const ObjectFitContain: Story = {
    render: () => (
        <div className="w-96 h-96 bg-gray-100">
            <DynamicImage
                src="https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Contain"
                alt="Object fit contain"
                objectFit="contain"
                className="w-full h-full"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with object-fit: contain - maintains aspect ratio within container.

### Features:
- Object-fit: contain
- Image maintains aspect ratio
- No cropping
            `,
            },
        },
    },
};

export const ObjectFitCover: Story = {
    render: () => (
        <div className="w-96 h-64 bg-gray-100">
            <DynamicImage
                src="https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Cover"
                alt="Object fit cover"
                objectFit="cover"
                className="w-full h-full"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with object-fit: cover - fills container and crops if needed.

### Features:
- Object-fit: cover (default)
- Image fills entire container
- May crop to fit
            `,
            },
        },
    },
};

export const RoundedCorners: Story = {
    render: () => (
        <div className="w-96">
            <DynamicImage
                src="https://via.placeholder.com/800[?sw={width}&q=60]"
                alt="Rounded image"
                widths={[400, 800]}
                borderRadius="lg"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with rounded corners.

### Features:
- Border radius: lg
- Overflow hidden applied automatically
            `,
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await waitForStorybookReady(canvasElement);
        const image = await canvas.findByRole('img', { name: /rounded image/i }, { timeout: 5000 });
        await expect(image).toBeInTheDocument();
    },
};

export const CircularImage: Story = {
    render: () => (
        <div className="w-64 h-64">
            <DynamicImage
                src="https://via.placeholder.com/400x400/4A90E2/FFFFFF?text=Circle"
                alt="Circular image"
                borderRadius="full"
                objectFit="cover"
                className="w-full h-full"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Circular image using border-radius: full.

### Features:
- Border radius: full
- Object-fit: cover for proper filling
- Square container for perfect circle
            `,
            },
        },
    },
};

export const WithShadow: Story = {
    render: () => (
        <div className="w-96">
            <DynamicImage
                src="https://via.placeholder.com/800[?sw={width}&q=60]"
                alt="Shadow image"
                widths={[400, 800]}
                boxShadow="xl"
                borderRadius="md"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with large shadow for elevation.

### Features:
- Extra large box shadow
- Medium border radius
- Creates depth and emphasis
            `,
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await waitForStorybookReady(canvasElement);
        const image = await canvas.findByRole('img', { name: /shadow image/i }, { timeout: 5000 });
        await expect(image).toBeInTheDocument();
    },
};

export const WithPadding: Story = {
    render: () => (
        <div className="w-96 bg-gray-100">
            <DynamicImage
                src="https://via.placeholder.com/800[?sw={width}&q=60]"
                alt="Padded image"
                widths={[400, 800]}
                padding="4"
                borderRadius="md"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with padding for spacing.

### Features:
- Padding: 4 (1rem)
- Medium border radius
- Visible with background color
            `,
            },
        },
    },
};

export const WithMargin: Story = {
    render: () => (
        <div className="flex gap-0 bg-gray-100 p-4">
            <div className="w-48">
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Image 1"
                    widths={[200, 400]}
                    margin="2"
                    borderRadius="md"
                />
            </div>
            <div className="w-48">
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Image 2"
                    widths={[200, 400]}
                    margin="2"
                    borderRadius="md"
                />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Images with margin spacing.

### Features:
- Margin: 2 (0.5rem)
- Creates spacing without wrapper gaps
- Medium border radius
            `,
            },
        },
    },
};

export const ScaleHoverEffect: Story = {
    render: () => (
        <div className="w-96">
            <DynamicImage
                src="https://via.placeholder.com/800[?sw={width}&q=60]"
                alt="Hover to scale"
                widths={[400, 800]}
                hoverEffect="scale"
                borderRadius="md"
                boxShadow="md"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with scale hover effect.

### Features:
- Scales up on hover (105%)
- Smooth transition
- Interactive feedback
            `,
            },
        },
    },
};

export const OpacityHoverEffect: Story = {
    render: () => (
        <div className="w-96">
            <DynamicImage
                src="https://via.placeholder.com/800[?sw={width}&q=60]"
                alt="Hover for opacity"
                widths={[400, 800]}
                hoverEffect="opacity"
                borderRadius="md"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with opacity hover effect.

### Features:
- Reduces opacity on hover (90%)
- Subtle interaction
- Smooth transition
            `,
            },
        },
    },
};

export const ShadowHoverEffect: Story = {
    render: () => (
        <div className="w-96">
            <DynamicImage
                src="https://via.placeholder.com/800[?sw={width}&q=60]"
                alt="Hover for shadow"
                widths={[400, 800]}
                hoverEffect="shadow"
                borderRadius="md"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image that shows shadow on hover.

### Features:
- Adds large shadow on hover
- Creates lift effect
- Smooth transition
            `,
            },
        },
    },
};

export const BrightnessHoverEffect: Story = {
    render: () => (
        <div className="w-96">
            <DynamicImage
                src="https://via.placeholder.com/800[?sw={width}&q=60]"
                alt="Hover for brightness"
                widths={[400, 800]}
                hoverEffect="brightness"
                borderRadius="md"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with brightness hover effect.

### Features:
- Increases brightness on hover (110%)
- Smooth transition
- Subtle highlight effect
            `,
            },
        },
    },
};

export const FullyCustomized: Story = {
    render: () => (
        <div className="w-96">
            <DynamicImage
                src="https://via.placeholder.com/800[?sw={width}&q=60]"
                alt="Premium image"
                widths={[400, 800]}
                objectFit="cover"
                borderRadius="xl"
                boxShadow="2xl"
                padding="3"
                margin="2"
                hoverEffect="scale"
                className="bg-white"
            />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
Image with all styling options configured.

### Features:
- Object-fit: cover
- Extra large border radius
- 2XL shadow
- Padding and margin
- Scale hover effect
- White background for padding visibility
            `,
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await waitForStorybookReady(canvasElement);
        const image = await canvas.findByRole('img', { name: /premium image/i }, { timeout: 5000 });
        await expect(image).toBeInTheDocument();
    },
};

export const AllBorderRadiusVariants: Story = {
    render: () => (
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
            <div>
                <p className="text-sm mb-2">None</p>
                <DynamicImage src="https://via.placeholder.com/400[?sw={width}&q=60]" alt="None" borderRadius="none" />
            </div>
            <div>
                <p className="text-sm mb-2">Small</p>
                <DynamicImage src="https://via.placeholder.com/400[?sw={width}&q=60]" alt="Small" borderRadius="sm" />
            </div>
            <div>
                <p className="text-sm mb-2">Medium</p>
                <DynamicImage src="https://via.placeholder.com/400[?sw={width}&q=60]" alt="Medium" borderRadius="md" />
            </div>
            <div>
                <p className="text-sm mb-2">Large</p>
                <DynamicImage src="https://via.placeholder.com/400[?sw={width}&q=60]" alt="Large" borderRadius="lg" />
            </div>
            <div>
                <p className="text-sm mb-2">Extra Large</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Extra Large"
                    borderRadius="xl"
                />
            </div>
            <div>
                <p className="text-sm mb-2">2X Large</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="2X Large"
                    borderRadius="2xl"
                />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
All available border radius options demonstrated.
            `,
            },
        },
    },
};

export const AllShadowVariants: Story = {
    render: () => (
        <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
            <div>
                <p className="text-sm mb-2">None</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="None"
                    boxShadow="none"
                    borderRadius="md"
                />
            </div>
            <div>
                <p className="text-sm mb-2">Small</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Small"
                    boxShadow="sm"
                    borderRadius="md"
                />
            </div>
            <div>
                <p className="text-sm mb-2">Medium</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Medium"
                    boxShadow="md"
                    borderRadius="md"
                />
            </div>
            <div>
                <p className="text-sm mb-2">Large</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Large"
                    boxShadow="lg"
                    borderRadius="md"
                />
            </div>
            <div>
                <p className="text-sm mb-2">Extra Large</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Extra Large"
                    boxShadow="xl"
                    borderRadius="md"
                />
            </div>
            <div>
                <p className="text-sm mb-2">2X Large</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="2X Large"
                    boxShadow="2xl"
                    borderRadius="md"
                />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
All available box shadow options demonstrated.
            `,
            },
        },
    },
};

export const AllObjectFitVariants: Story = {
    render: () => (
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
            <div>
                <p className="text-sm mb-2">Contain</p>
                <div className="w-full h-48 bg-gray-100">
                    <DynamicImage
                        src="https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Contain"
                        alt="Contain"
                        objectFit="contain"
                        borderRadius="md"
                        className="w-full h-full"
                    />
                </div>
            </div>
            <div>
                <p className="text-sm mb-2">Cover</p>
                <div className="w-full h-48 bg-gray-100">
                    <DynamicImage
                        src="https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Cover"
                        alt="Cover"
                        objectFit="cover"
                        borderRadius="md"
                        className="w-full h-full"
                    />
                </div>
            </div>
            <div>
                <p className="text-sm mb-2">Fill</p>
                <div className="w-full h-48 bg-gray-100">
                    <DynamicImage
                        src="https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Fill"
                        alt="Fill"
                        objectFit="fill"
                        borderRadius="md"
                        className="w-full h-full"
                    />
                </div>
            </div>
            <div>
                <p className="text-sm mb-2">None</p>
                <div className="w-full h-48 bg-gray-100">
                    <DynamicImage
                        src="https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=None"
                        alt="None"
                        objectFit="none"
                        borderRadius="md"
                        className="w-full h-full"
                    />
                </div>
            </div>
            <div>
                <p className="text-sm mb-2">Scale Down</p>
                <div className="w-full h-48 bg-gray-100">
                    <DynamicImage
                        src="https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=ScaleDown"
                        alt="Scale Down"
                        objectFit="scale-down"
                        borderRadius="md"
                        className="w-full h-full"
                    />
                </div>
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
All available object-fit options demonstrated.
            `,
            },
        },
    },
};

export const AllHoverEffects: Story = {
    render: () => (
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
            <div>
                <p className="text-sm mb-2">Scale</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Scale"
                    hoverEffect="scale"
                    borderRadius="md"
                />
            </div>
            <div>
                <p className="text-sm mb-2">Opacity</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Opacity"
                    hoverEffect="opacity"
                    borderRadius="md"
                />
            </div>
            <div>
                <p className="text-sm mb-2">Shadow</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Shadow"
                    hoverEffect="shadow"
                    borderRadius="md"
                />
            </div>
            <div>
                <p className="text-sm mb-2">Brightness</p>
                <DynamicImage
                    src="https://via.placeholder.com/400[?sw={width}&q=60]"
                    alt="Brightness"
                    hoverEffect="brightness"
                    borderRadius="md"
                />
            </div>
        </div>
    ),
    parameters: {
        docs: {
            description: {
                story: `
All available hover effects demonstrated. Hover over each image to see the effect.
            `,
            },
        },
    },
};
