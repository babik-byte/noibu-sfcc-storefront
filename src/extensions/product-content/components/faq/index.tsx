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
import { type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import CollapsibleSection from '@/components/collapsible-section';
import { openShopperAgentAndSendMessage } from '@/components/shopper-agent';
import { isShopperAgentContextUiEnabled } from '@/lib/shopper-context/agent-ui';
import { validateShopperAgentConfig } from '@/components/shopper-agent/shopper-agent.utils';
import FaqQuestionItem from './faq-question-item';

/**
 * Tailwind classes for the small "AI" label next to "Ask assistant" in the collapsible summary.
 * Used only here on the PDP FAQ section header.
 */
const AI_BADGE_CLASSES =
    'inline-flex items-center justify-center rounded px-3 py-1 text-xs font-medium min-w-10 bg-muted text-foreground';

export interface FaqProps {
    /** FAQ questions resolved from the route loader. */
    questions: string[];
}

/**
 * @feature-stub Ask assistant FAQ
 * @status stub — no backend integration
 *
 * Ask assistant FAQ section for PDP. Only shown when the shopper agent is enabled, configured,
 * and {@link isShopperAgentContextUiEnabled} is true (product-context prompts).
 * Receives questions as a prop from the route loader and renders a collapsible section with
 * "Ask assistant" + AI badge and clickable question rows.
 */
export default function Faq({ questions }: FaqProps): ReactElement | null {
    const { t } = useTranslation('extProductContent');
    const config = useConfig();
    const showShopperAgent =
        (config.commerceAgent?.enabled === 'true' || config.commerceAgent?.enabled === true) &&
        validateShopperAgentConfig(config.commerceAgent);
    const showPdpAgentFaq = showShopperAgent && isShopperAgentContextUiEnabled();

    if (!showPdpAgentFaq || questions.length === 0) {
        return null;
    }

    const handleQuestionClick = (question: string) => {
        openShopperAgentAndSendMessage(question);
    };

    return (
        <CollapsibleSection
            label={t('faq.askAssistant')}
            labelSupplement={<span className={AI_BADGE_CLASSES}>AI</span>}
            defaultOpen={true}
            className="mt-4">
            <div className="flex flex-col gap-2">
                {questions.map((question, index) => (
                    <FaqQuestionItem
                        // eslint-disable-next-line react/no-array-index-key -- adapter order is stable per load; index keeps keys aligned with list order (duplicate question text allowed)
                        key={index}
                        question={question}
                        onClick={handleQuestionClick}
                        ariaLabel={t('faq.faqQuestionSendToAssistantAriaLabel', { question })}
                    />
                ))}
            </div>
        </CollapsibleSection>
    );
}
