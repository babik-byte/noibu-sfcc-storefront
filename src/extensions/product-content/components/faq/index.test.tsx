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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAltSiteObject } from '@/test-utils/config';
import Faq from './index';

const { mockOpenShopperAgentAndSendMessage, mockUseConfig, mockIsShopperAgentContextUiEnabled } = vi.hoisted(() => ({
    mockOpenShopperAgentAndSendMessage: vi.fn(),
    mockUseConfig: vi.fn(),
    mockIsShopperAgentContextUiEnabled: vi.fn(() => true),
}));

vi.mock('@/components/shopper-agent', () => ({
    openShopperAgentAndSendMessage: mockOpenShopperAgentAndSendMessage,
}));

vi.mock('@/lib/shopper-context/agent-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/shopper-context/agent-ui')>();
    return {
        ...actual,
        isShopperAgentContextUiEnabled: () => mockIsShopperAgentContextUiEnabled(),
    };
});

vi.mock('@salesforce/storefront-next-runtime/config', async () => {
    const actual = await vi.importActual<typeof import('@salesforce/storefront-next-runtime/config')>(
        '@salesforce/storefront-next-runtime/config'
    );
    return {
        ...actual,
        useConfig: () => mockUseConfig(),
    };
});

const validCommerceAgent = {
    enabled: 'true' as const,
    embeddedServiceName: 'test_service',
    embeddedServiceEndpoint: 'https://test.my.site.com/ESWtest',
    scriptSourceUrl: 'https://test.my.site.com/ESWtest/assets/js/bootstrap.min.js',
    scrt2Url: 'https://test.salesforce-scrt.com',
    salesforceOrgId: '00Dxx0000000000',
    siteId: mockAltSiteObject.id,
};

const mockQuestions = [
    'What sizes does this come in?',
    'Which color would work best for a minimalist space?',
    'Will this work in a minimalist living room?',
];

describe('Faq', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsShopperAgentContextUiEnabled.mockReturnValue(true);
        mockUseConfig.mockReturnValue({ commerceAgent: validCommerceAgent });
    });

    it('renders Ask assistant section with the supplied questions', () => {
        render(<Faq questions={mockQuestions} />);

        expect(screen.getByText('Ask assistant')).toBeInTheDocument();
        expect(screen.getByText('AI')).toBeInTheDocument();
        expect(screen.getByText('What sizes does this come in?')).toBeInTheDocument();
        expect(screen.getByText('Which color would work best for a minimalist space?')).toBeInTheDocument();
        expect(screen.getByText('Will this work in a minimalist living room?')).toBeInTheDocument();
    });

    it('renders nothing when questions are empty', () => {
        const { container } = render(<Faq questions={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('opens shopper agent with the FAQ question on click', async () => {
        const user = userEvent.setup();
        render(<Faq questions={mockQuestions} />);

        const button = await screen.findByRole('button', {
            name: /Open shopper agent and ask: What sizes does this come in\?/,
        });
        await user.click(button);

        expect(mockOpenShopperAgentAndSendMessage).toHaveBeenCalledTimes(1);
        expect(mockOpenShopperAgentAndSendMessage).toHaveBeenCalledWith('What sizes does this come in?');
    });

    it('renders nothing when commerce agent is disabled', () => {
        mockUseConfig.mockReturnValue({
            commerceAgent: { ...validCommerceAgent, enabled: 'false' },
        });
        const { container } = render(<Faq questions={mockQuestions} />);
        expect(container.firstChild).toBeNull();
        expect(mockOpenShopperAgentAndSendMessage).not.toHaveBeenCalled();
    });

    it('renders nothing when product context UI is off', () => {
        mockIsShopperAgentContextUiEnabled.mockReturnValue(false);
        const { container } = render(<Faq questions={mockQuestions} />);
        expect(container.firstChild).toBeNull();
    });
});
