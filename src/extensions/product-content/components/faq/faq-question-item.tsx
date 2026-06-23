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
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SparklesIcon } from '@/components/icons';

export interface FaqQuestionItemProps {
    /** The question text to display */
    question: string;
    /** Optional click handler when the entire box is clicked */
    onClick?: (question: string) => void;
    /** Optional accessible label (e.g. when opening chat with this question) */
    ariaLabel?: string;
    /** Optional additional class names */
    className?: string;
}

/**
 * A single clickable FAQ question row with sparkle icon, question text, and chevron.
 * The entire box is clickable; border becomes more prominent on hover.
 */
export default function FaqQuestionItem({
    question,
    onClick,
    ariaLabel,
    className,
}: FaqQuestionItemProps): ReactElement {
    return (
        <button
            type="button"
            onClick={() => onClick?.(question)}
            aria-label={ariaLabel}
            className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-none border border-border bg-background px-3 py-3 text-left text-sm text-foreground transition-colors',
                'hover:border-muted-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                className
            )}>
            <SparklesIcon className="size-4 shrink-0 text-foreground" aria-hidden />
            <span className="min-w-0 flex-1">{question}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
    );
}
