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
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import RecentSearches from './recent-searches';
import SuggestionSection from './suggestions-section';
import type { SearchSuggestions } from './types';

const AiInsightCard = lazy(() => import('@/components/ai-insight-card').then((m) => ({ default: m.AiInsightCard })));

interface SuggestionsProps {
    searchSuggestions: SearchSuggestions | null;
    recentSearches: string[];
    closeAndNavigate: (link: string) => void;
    clearRecentSearches: () => void;
    showShopperAgent?: boolean;
    onShopperAgentClick?: () => void;
}

export default function Suggestions({
    searchSuggestions,
    recentSearches,
    closeAndNavigate,
    clearRecentSearches,
    showShopperAgent = false,
    onShopperAgentClick,
}: SuggestionsProps) {
    const { t } = useTranslation('search');
    const hasCategories = Boolean(searchSuggestions?.categorySuggestions?.length);
    const hasProducts = Boolean(searchSuggestions?.productSuggestions?.length);
    const hasPopularSearches = Boolean(searchSuggestions?.popularSearchSuggestions?.length);
    const hasSuggestions = hasCategories || hasProducts || hasPopularSearches;

    return (
        <div>
            {searchSuggestions && hasSuggestions ? (
                <SuggestionSection searchSuggestions={searchSuggestions} closeAndNavigate={closeAndNavigate} />
            ) : (
                <RecentSearches
                    recentSearches={recentSearches}
                    closeAndNavigate={closeAndNavigate}
                    clearRecentSearches={clearRecentSearches}
                />
            )}
            {showShopperAgent && onShopperAgentClick && (
                <div
                    className="w-full min-w-0 border-t border-border shrink-0 overflow-visible py-3 section-container"
                    data-testid="search-shopper-agent">
                    <Suspense fallback={null}>
                        <AiInsightCard
                            variant="shoppingAssistant"
                            compact
                            title={t('shopperAgent.title')}
                            description={t('shopperAgent.description')}
                            onActionClick={onShopperAgentClick}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
}
