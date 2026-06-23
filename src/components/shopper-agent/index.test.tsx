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
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockAltSiteObject } from '@/test-utils/config';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import ShopperAgent, { SHOPPER_AGENT_LOAD_EVENT } from './index';

vi.mock('./shopper-agent-window', () => ({
    ShopperAgentWindow: () => <div data-testid="shopper-agent-window">ShopperAgentWindow</div>,
}));

vi.mock('./shopper-agent-ui', () => ({
    default: function MockShopperAgentUI() {
        return (
            <div data-testid="shopper-agent">
                <div data-testid="shopper-agent-window">ShopperAgentWindow</div>
            </div>
        );
    },
}));

const originalRequestIdleCallback = globalThis.requestIdleCallback;
const originalCancelIdleCallback = globalThis.cancelIdleCallback;

const validConfig = {
    enabled: 'true',
    embeddedServiceName: 'test_service',
    embeddedServiceEndpoint: 'https://test.my.site.com/ESW',
    scriptSourceUrl: 'https://test.my.site.com/ESW/bootstrap.js',
    scrt2Url: 'https://test.salesforce-scrt.com',
    salesforceOrgId: '00Dxx0000000000',
    siteId: mockAltSiteObject.id,
};

describe('ShopperAgent', () => {
    beforeEach(() => {
        globalThis.requestIdleCallback = (cb: IdleRequestCallback) => {
            cb({ didTimeout: false, timeRemaining: () => 50 });
            return 0;
        };
        globalThis.cancelIdleCallback = vi.fn();
    });

    afterEach(() => {
        globalThis.requestIdleCallback = originalRequestIdleCallback;
        globalThis.cancelIdleCallback = originalCancelIdleCallback;
    });

    test('renders wrapper and ShopperAgentWindow when config is valid', async () => {
        render(
            <ShopperAgent commerceAgentConfiguration={validConfig} locale="en-US" currency="USD" userId="user-1" />,
            {
                wrapper: AllProvidersWrapper,
            }
        );

        await waitFor(() => {
            expect(screen.getByTestId('shopper-agent')).toBeInTheDocument();
        });
        expect(screen.getByTestId('shopper-agent-window')).toBeInTheDocument();
        expect(screen.getByText('ShopperAgentWindow')).toBeInTheDocument();
    });

    test('passes locale to ShopperAgentWindow', async () => {
        render(<ShopperAgent commerceAgentConfiguration={validConfig} locale="en-GB" />, {
            wrapper: AllProvidersWrapper,
        });

        await waitFor(() => {
            expect(screen.getByTestId('shopper-agent')).toBeInTheDocument();
        });
    });

    test('loads on demand when SHOPPER_AGENT_LOAD_EVENT is dispatched (click before idle)', async () => {
        // Don't run idle callback immediately so component stays in deferred state
        globalThis.requestIdleCallback = vi.fn(() => 1);
        globalThis.cancelIdleCallback = vi.fn();

        render(<ShopperAgent commerceAgentConfiguration={validConfig} locale="en-US" />, {
            wrapper: AllProvidersWrapper,
        });

        expect(screen.queryByTestId('shopper-agent')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent(SHOPPER_AGENT_LOAD_EVENT));
        });

        await waitFor(() => {
            expect(screen.getByTestId('shopper-agent')).toBeInTheDocument();
        });
        expect(globalThis.cancelIdleCallback).toHaveBeenCalledWith(1);
    });
});
