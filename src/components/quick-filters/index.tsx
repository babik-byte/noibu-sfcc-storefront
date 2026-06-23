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
import { type ReactElement, useCallback, useMemo } from 'react';
import { useLocation, useNavigation } from 'react-router';
import { useNavigate } from '@/hooks/use-navigate';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ShopperProducts } from '@/scapi';

interface QuickFiltersProps {
    category?: ShopperProducts.schemas['Category'];
}

/**
 * QuickFilters Component
 *
 * Displays category subcategories as horizontal chips for quick access without opening the refinements panel.
 *
 * Features:
 * - Horizontal chip/button layout
 * - Active state for selected filters
 * - Optimistic UI during navigation
 * - Displays direct subcategories from category.categories on category pages
 * - Responsive with horizontal scroll on overflow
 *
 * @param props - Component props
 * @param props.category - Category object with subcategories from SCAPI
 */
export default function QuickFilters({ category }: QuickFiltersProps): ReactElement | null {
    const navigate = useNavigate();
    const location = useLocation();
    const navigation = useNavigation();
    const isPending = navigation.state !== 'idle';

    // Get subcategories to display from category.categories
    const categories = useMemo(() => {
        if (!category?.categories?.length) {
            return [];
        }

        return category.categories.map((cat) => ({
            value: cat.id,
            label: cat.name || cat.id,
        }));
    }, [category?.categories]);

    // Get active cgid refinements from optimistic state or current location
    const activeRefinements = useMemo(() => {
        const searchParams = navigation.location ? navigation.location.search : location.search;
        const params = new URLSearchParams(searchParams);
        return params.getAll('refine');
    }, [navigation.location, location.search]);

    // Handle category chip click
    const handleCategoryClick = useCallback(
        (categoryValue: string) => {
            const params = new URLSearchParams(location.search);
            const refines = params.getAll('refine');
            const cgidRefinement = `cgid=${categoryValue}`;

            // Check if this refinement is already selected
            const isSelected = refines.includes(cgidRefinement);

            let nextRefines: string[];
            if (isSelected) {
                // Remove this refinement (unfilter)
                nextRefines = refines.filter((r) => r !== cgidRefinement);
            } else {
                // Remove any existing cgid refinements and add the new one
                nextRefines = [...refines.filter((r) => !r.startsWith('cgid=')), cgidRefinement];
            }

            // Rebuild search params with the new refines
            params.delete('refine');
            nextRefines.forEach((r) => params.append('refine', r));
            params.set('offset', '0');

            void navigate({
                pathname: location.pathname,
                search: `?${params.toString()}`,
            });
        },
        [location.search, location.pathname, navigate]
    );

    // Don't render if no categories available
    if (categories.length === 0) {
        return null;
    }

    return (
        <div
            className={`flex flex-wrap gap-2${isPending ? ' pointer-events-none opacity-50 transition-opacity' : ''}`}
            role="group"
            aria-label="Quick category filters">
            {categories.map((cat) => {
                const cgidRefinement = `cgid=${cat.value}`;
                const isActive = activeRefinements.includes(cgidRefinement);
                return (
                    <Button
                        key={cat.value}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleCategoryClick(cat.value)}
                        className={cn(
                            'whitespace-nowrap rounded-none cursor-pointer text-sm font-normal leading-5 tracking-[-0.15px]',
                            isActive ? 'text-primary-foreground' : 'text-foreground'
                        )}
                        aria-pressed={isActive}>
                        {cat.label || cat.value}
                    </Button>
                );
            })}
        </div>
    );
}
