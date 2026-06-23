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

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FaqQuestionItem from './faq-question-item';

describe('FaqQuestionItem', () => {
    it('renders question text', () => {
        render(<FaqQuestionItem question="What sizes does this come in?" />);
        expect(screen.getByText('What sizes does this come in?')).toBeInTheDocument();
    });

    it('renders as a button', () => {
        render(<FaqQuestionItem question="Test question" />);
        const button = screen.getByRole('button', { name: /test question/i });
        expect(button).toBeInTheDocument();
    });

    it('calls onClick with the question when clicked', () => {
        const onClick = vi.fn();
        render(<FaqQuestionItem question="Which color?" onClick={onClick} />);

        fireEvent.click(screen.getByRole('button', { name: /which color\?/i }));

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith('Which color?');
    });

    it('applies custom className', () => {
        const { container } = render(<FaqQuestionItem question="Q" className="custom-class" />);
        const button = container.querySelector('button.custom-class');
        expect(button).toBeInTheDocument();
    });

    it('uses aria-label when provided', () => {
        render(<FaqQuestionItem question="Short" ariaLabel="Open shopper agent and ask: Short" />);
        expect(screen.getByRole('button', { name: 'Open shopper agent and ask: Short' })).toBeInTheDocument();
    });
});
