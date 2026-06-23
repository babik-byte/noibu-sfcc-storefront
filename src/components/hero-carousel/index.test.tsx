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
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import HeroCarousel, { type HeroSlide } from './index';
import type { CarouselApi } from '@/components/ui/carousel';

// Mock data constants
const mockSlides: HeroSlide[] = [
    {
        id: '1',
        title: 'First Slide',
        subtitle: 'First subtitle',
        imageUrl: '/image1.jpg',
        imageAlt: 'First image',
        ctaText: 'Learn More',
        ctaLink: '/learn-more',
    },
    {
        id: '2',
        title: 'Second Slide',
        subtitle: 'Second subtitle',
        imageUrl: '/image2.jpg',
        imageAlt: 'Second image',
        ctaText: 'Shop Now',
        ctaLink: '/shop',
    },
    {
        id: '3',
        title: 'Third Slide',
        imageUrl: '/image3.jpg',
        imageAlt: 'Third image',
    },
];

const mockCarouselApi = {
    scrollNext: vi.fn(),
    scrollPrev: vi.fn(),
    scrollTo: vi.fn(),
    canScrollNext: vi.fn(() => true),
    canScrollPrev: vi.fn(() => true),
    selectedScrollSnap: vi.fn(() => 0),
    on: vi.fn(),
    off: vi.fn(),
} as unknown as CarouselApi;

// Simplified mocks
vi.mock('@/components/ui/carousel', () => ({
    Carousel: ({ children, setApi }: { children: React.ReactNode; setApi: (api: CarouselApi) => void }) => {
        React.useEffect(() => {
            setApi(mockCarouselApi);
        }, [setApi]);
        return <div data-testid="carousel">{children}</div>;
    },
    CarouselContent: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="carousel-content">{children}</div>
    ),
    CarouselItem: ({ children }: { children: React.ReactNode }) => <div data-testid="carousel-item">{children}</div>,
}));

vi.mock('lucide-react', () => ({
    ChevronLeft: () => <div data-testid="chevron-left" />,
    ChevronRight: () => <div data-testid="chevron-right" />,
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, asChild, className }: { children: React.ReactNode; asChild?: boolean; className?: string }) =>
        asChild ? children : <button className={className}>{children}</button>,
}));

// Router testing helper
const renderWithRouter = (component: React.ReactElement) => {
    const router = createMemoryRouter(
        [
            {
                path: '*',
                element: <AllProvidersWrapper>{component}</AllProvidersWrapper>,
            },
        ],
        { initialEntries: ['/'] }
    );
    return render(<RouterProvider router={router} />);
};

describe('HeroCarousel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    describe('Rendering', () => {
        test('renders carousel with slides and content', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} />);

            expect(screen.getByTestId('carousel')).toBeInTheDocument();
            expect(screen.getByText('First Slide')).toBeInTheDocument();
            expect(screen.getByText('First subtitle')).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Shop Now' })).toHaveAttribute('href', '/global/en-GB/shop');

            // Check for Learn More links with specific hrefs
            const learnMoreLinks = screen.getAllByRole('link', { name: 'Learn More' });
            expect(learnMoreLinks).toHaveLength(2);
            expect(learnMoreLinks[0]).toHaveAttribute('href', '/global/en-GB/learn-more');
            expect(learnMoreLinks[1]).toHaveAttribute('href', '/');
        });

        test('renders empty state when no slides provided', () => {
            renderWithRouter(<HeroCarousel slides={[]} />);

            expect(screen.getByText('No slides available')).toBeInTheDocument();
        });

        test('handles slides without optional content', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} />);

            expect(screen.getByText('Third Slide')).toBeInTheDocument();
            expect(screen.queryByText('Third subtitle')).not.toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        test('renders navigation controls when multiple slides exist', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} showDots={true} showNavigation={true} />);

            expect(screen.getAllByRole('tab')).toHaveLength(3);
            expect(screen.getByLabelText(/previous slide/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/next slide/i)).toBeInTheDocument();
        });

        test('hides navigation controls when only one slide', () => {
            renderWithRouter(<HeroCarousel slides={[mockSlides[0]]} showDots={true} showNavigation={true} />);

            expect(screen.queryByRole('tab')).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/previous slide/i)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/next slide/i)).not.toBeInTheDocument();
        });

        test('handles dot navigation clicks', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} />);

            const dots = screen.getAllByRole('tab');
            fireEvent.click(dots[1]);

            expect(mockCarouselApi?.scrollTo).toHaveBeenCalledWith(1);
        });

        test('handles arrow navigation clicks', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} />);

            const prevButton = screen.getByLabelText(/previous slide/i);
            const nextButton = screen.getByLabelText(/next slide/i);

            fireEvent.click(prevButton);
            expect(mockCarouselApi?.scrollPrev).toHaveBeenCalled();

            fireEvent.click(nextButton);
            expect(mockCarouselApi?.scrollNext).toHaveBeenCalled();
        });

        test('handles keyboard navigation', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} />);

            const carousel = screen.getByRole('region');

            fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
            expect(mockCarouselApi?.scrollPrev).toHaveBeenCalled();

            fireEvent.keyDown(carousel, { key: 'ArrowRight' });
            expect(mockCarouselApi?.scrollNext).toHaveBeenCalled();

            fireEvent.keyDown(carousel, { key: 'Home' });
            expect(mockCarouselApi?.scrollTo).toHaveBeenCalledWith(0);

            fireEvent.keyDown(carousel, { key: 'End' });
            expect(mockCarouselApi?.scrollTo).toHaveBeenCalledWith(2);
        });
    });

    describe('Auto-play', () => {
        test('starts auto-play when enabled', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} autoPlay={true} autoPlayInterval={1000} />);

            act(() => {
                vi.advanceTimersByTime(1000);
            });

            expect(mockCarouselApi?.scrollNext).toHaveBeenCalled();
        });

        test('pauses auto-play on user interaction', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} autoPlay={true} autoPlayInterval={1000} />);

            const carousel = screen.getByRole('region');
            fireEvent.focus(carousel);

            act(() => {
                vi.advanceTimersByTime(1000);
            });

            expect(mockCarouselApi?.scrollNext).not.toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        test('has correct ARIA attributes', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} />);

            const carousel = screen.getByRole('region');
            expect(carousel).toHaveAttribute('aria-label', 'Hero carousel with 3 slides');
            expect(carousel).toHaveAttribute('tabIndex', '0');

            const dots = screen.getAllByRole('tab');
            expect(dots[0]).toHaveAttribute('aria-label', 'Go to slide 1 of 3');
            expect(dots[0]).toHaveAttribute('aria-selected', 'true');
        });
    });

    describe('Props', () => {
        test('respects custom configuration', () => {
            renderWithRouter(
                <HeroCarousel slides={mockSlides} autoPlay={false} showDots={false} showNavigation={false} />
            );

            expect(screen.queryByRole('tab')).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/previous slide/i)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/next slide/i)).not.toBeInTheDocument();
        });

        test('handles missing optional props', () => {
            const slidesWithoutCta = [
                {
                    id: '1',
                    title: 'Test Slide',
                    imageUrl: '/test.jpg',
                    imageAlt: 'Test image',
                },
            ];

            renderWithRouter(<HeroCarousel slides={slidesWithoutCta} />);

            expect(screen.getByText('Learn More')).toBeInTheDocument();
            expect(screen.getByRole('link')).toHaveAttribute('href', '/');
        });
    });

    describe('Initial Load and State Management (PR #164)', () => {
        test('initializes navigation state and sets up event listeners', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} />);

            // Verify that onSelect is called immediately to set initial state
            expect(mockCarouselApi?.selectedScrollSnap).toHaveBeenCalled();
            expect(mockCarouselApi?.canScrollPrev).toHaveBeenCalled();
            expect(mockCarouselApi?.canScrollNext).toHaveBeenCalled();

            // Verify event listeners are set up
            expect(mockCarouselApi?.on).toHaveBeenCalledWith('select', expect.any(Function));
            expect(mockCarouselApi?.on).toHaveBeenCalledWith('reInit', expect.any(Function));
        });

        test('validates navigation and cleans up properly', () => {
            const { unmount } = renderWithRouter(<HeroCarousel slides={mockSlides} />);

            // Test keyboard navigation with valid indices
            const carousel = screen.getByRole('region');
            fireEvent.keyDown(carousel, { key: 'Home' });
            expect(mockCarouselApi?.scrollTo).toHaveBeenCalledWith(0);

            fireEvent.keyDown(carousel, { key: 'End' });
            expect(mockCarouselApi?.scrollTo).toHaveBeenCalledWith(2);

            // Test cleanup on unmount
            unmount();
            expect(mockCarouselApi?.off).toHaveBeenCalledWith('select', expect.any(Function));
            expect(mockCarouselApi?.off).toHaveBeenCalledWith('reInit', expect.any(Function));
        });

        test('handles onSelect callback state updates', () => {
            renderWithRouter(<HeroCarousel slides={mockSlides} />);

            // Get and trigger the onSelect callback
            const onMock = mockCarouselApi?.on as any;
            const selectCall = onMock?.mock?.calls?.find((call: any[]) => call[0] === 'select');
            const onSelectCallback = selectCall?.[1];

            if (onSelectCallback) {
                act(() => {
                    onSelectCallback();
                });
            }

            // Verify state update methods are called
            expect(mockCarouselApi?.selectedScrollSnap).toHaveBeenCalled();
            expect(mockCarouselApi?.canScrollPrev).toHaveBeenCalled();
            expect(mockCarouselApi?.canScrollNext).toHaveBeenCalled();
        });
    });
});
