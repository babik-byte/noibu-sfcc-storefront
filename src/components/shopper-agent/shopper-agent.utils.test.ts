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
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockAltSiteObject } from '@/test-utils/config';
import {
    validateSalesforceDomain,
    validateShopperAgentConfig,
    isShopperAgentEnabled,
    launchChat,
    sendTextMessage,
    openShopperAgent,
    openShopperAgentAndSendMessage,
    notifyEmbeddedMessagingFirstBotMessageSent,
    resetShopperAgentSessionStateForTests,
    type ShopperAgentConfig,
} from './shopper-agent.utils';

const validConfig: ShopperAgentConfig = {
    enabled: 'true',
    embeddedServiceName: 'test_service',
    embeddedServiceEndpoint: 'https://test.my.site.com/ESWtest',
    scriptSourceUrl: 'https://test.my.site.com/ESWtest/assets/js/bootstrap.min.js',
    scrt2Url: 'https://test.salesforce-scrt.com',
    salesforceOrgId: '00Dxx0000000000',
    siteId: mockAltSiteObject.id,
};

describe('validateSalesforceDomain', () => {
    test('returns true for .salesforce.com', () => {
        expect(validateSalesforceDomain('https://myorg.salesforce.com/script.js')).toBe(true);
    });

    test('returns true for .salesforce-scrt.com', () => {
        expect(validateSalesforceDomain('https://myorg.salesforce-scrt.com/assets/bootstrap.js')).toBe(true);
    });

    test('returns true for .pc-rnd.site.com', () => {
        expect(validateSalesforceDomain('https://orgfarm-abc.test.pc-rnd.site.com/ESW')).toBe(true);
    });

    test('returns true for .my.site.com', () => {
        expect(validateSalesforceDomain('https://myorg.my.site.com/embed')).toBe(true);
    });

    test('returns false for non-Salesforce domain', () => {
        expect(validateSalesforceDomain('https://evil.com/script.js')).toBe(false);
    });

    test('returns false for invalid URL', () => {
        expect(validateSalesforceDomain('not-a-url')).toBe(false);
    });

    test('returns false for subdomain takeover (e.g. salesforce.com.attacker.com)', () => {
        expect(validateSalesforceDomain('https://salesforce.com.attacker.com/script.js')).toBe(false);
        expect(validateSalesforceDomain('https://foo.salesforce.com.evil.com/script.js')).toBe(false);
    });
});

describe('validateShopperAgentConfig', () => {
    test('returns true for valid config with all required fields', () => {
        expect(validateShopperAgentConfig(validConfig)).toBe(true);
    });

    test('returns true when enabled is boolean true (e.g. from env/JSON parse)', () => {
        expect(validateShopperAgentConfig({ ...validConfig, enabled: true })).toBe(true);
    });

    test('returns false for null', () => {
        expect(validateShopperAgentConfig(null)).toBe(false);
    });

    test('returns false for non-object', () => {
        expect(validateShopperAgentConfig('string')).toBe(false);
        expect(validateShopperAgentConfig(123)).toBe(false);
    });

    test('returns false when required field is missing', () => {
        const partial = Object.fromEntries(Object.entries(validConfig).filter(([key]) => key !== 'siteId'));
        expect(validateShopperAgentConfig(partial)).toBe(false);
    });

    test('returns false when required field is empty string', () => {
        expect(validateShopperAgentConfig({ ...validConfig, embeddedServiceName: '' })).toBe(false);
    });

    test('returns false when scriptSourceUrl is not from trusted domain', () => {
        expect(
            validateShopperAgentConfig({
                ...validConfig,
                scriptSourceUrl: 'https://evil.com/bootstrap.js',
            })
        ).toBe(false);
    });

    test('returns true with valid optional enableConversationContext', () => {
        expect(validateShopperAgentConfig({ ...validConfig, enableConversationContext: 'true' })).toBe(true);
    });

    test('returns false when enableConversationContext is not a string', () => {
        expect(
            validateShopperAgentConfig({ ...validConfig, enableConversationContext: true as unknown as string })
        ).toBe(false);
    });

    test('returns true with valid optional conversationContext array', () => {
        expect(validateShopperAgentConfig({ ...validConfig, conversationContext: ['a', 'b'] })).toBe(true);
    });

    test('returns false when conversationContext is not an array', () => {
        expect(
            validateShopperAgentConfig({ ...validConfig, conversationContext: 'not-array' as unknown as string[] })
        ).toBe(false);
    });
});

describe('isShopperAgentEnabled', () => {
    test('returns true when enabled is "true" and window is defined', () => {
        expect(typeof window).toBe('object');
        expect(isShopperAgentEnabled('true')).toBe(true);
    });

    test('returns true when enabled is boolean true (e.g. from env merge)', () => {
        expect(isShopperAgentEnabled(true)).toBe(true);
    });

    test('returns false when enabled is not "true" or true', () => {
        expect(isShopperAgentEnabled('false')).toBe(false);
        expect(isShopperAgentEnabled('')).toBe(false);
        expect(isShopperAgentEnabled(false)).toBe(false);
    });
});

const stubBootstrapInit = vi.fn();

describe('launchChat', () => {
    const originalBootstrap = window.embeddedservice_bootstrap;

    beforeEach(() => {
        vi.clearAllMocks();
        resetShopperAgentSessionStateForTests();
    });

    afterEach(() => {
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = originalBootstrap;
    });

    test('calls utilAPI.launchChat when available', () => {
        const launchChatFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: launchChatFn,
                sendTextMessage: vi.fn().mockResolvedValue(undefined),
            },
            settings: { language: 'en' },
        };

        launchChat();

        expect(launchChatFn).toHaveBeenCalledTimes(1);
    });

    test('calls showChatButton then launchChat when hideChatButtonOnLoad is true', () => {
        const showChatButtonFn = vi.fn().mockResolvedValue(undefined);
        const launchChatFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: launchChatFn,
                sendTextMessage: vi.fn().mockResolvedValue(undefined),
                showChatButton: showChatButtonFn,
            },
            settings: { language: 'en', hideChatButtonOnLoad: true },
        };

        launchChat();

        expect(showChatButtonFn).toHaveBeenCalledTimes(1);
        expect(launchChatFn).toHaveBeenCalledTimes(1);
    });

    test('does not throw when utilAPI is missing', () => {
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            settings: { language: 'en' },
        };

        expect(() => launchChat()).not.toThrow();
    });
});

describe('sendTextMessage', () => {
    const originalBootstrap = window.embeddedservice_bootstrap;

    afterEach(() => {
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = originalBootstrap;
    });

    test('calls utilAPI.sendTextMessage with message when available', () => {
        const sendTextMessageFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: vi.fn().mockResolvedValue(undefined),
                sendTextMessage: sendTextMessageFn,
            },
            settings: { language: 'en' },
        };

        sendTextMessage('Hello');

        expect(sendTextMessageFn).toHaveBeenCalledWith('Hello');
        expect(sendTextMessageFn).toHaveBeenCalledTimes(1);
    });

    test('does not throw when utilAPI.sendTextMessage is missing', () => {
        // Partial utilAPI (no sendTextMessage) - cast to satisfy type for test
        (window as unknown as { embeddedservice_bootstrap: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: { launchChat: vi.fn().mockResolvedValue(undefined) },
            settings: { language: 'en' },
        };

        expect(() => sendTextMessage('Hi')).not.toThrow();
    });
});

describe('openShopperAgentAndSendMessage', () => {
    const originalBootstrap = window.embeddedservice_bootstrap;

    beforeEach(() => {
        resetShopperAgentSessionStateForTests();
        vi.clearAllMocks();
    });

    afterEach(() => {
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = originalBootstrap;
    });

    test('empty or whitespace-only query only launches chat (no sendTextMessage)', () => {
        const launchChatFn = vi.fn().mockResolvedValue(undefined);
        const sendTextMessageFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: launchChatFn,
                sendTextMessage: sendTextMessageFn,
            },
            settings: { language: 'en' },
        };

        openShopperAgentAndSendMessage('   ');

        expect(launchChatFn).toHaveBeenCalledTimes(1);
        expect(sendTextMessageFn).not.toHaveBeenCalled();
    });

    test('first query sends after onEmbeddedMessagingFirstBotMessageSent (simulated)', () => {
        const sendTextMessageFn = vi.fn().mockResolvedValue(undefined);
        const launchChatFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: launchChatFn,
                sendTextMessage: sendTextMessageFn,
            },
            settings: { language: 'en' },
        };

        openShopperAgentAndSendMessage('running shoes');

        expect(launchChatFn).toHaveBeenCalledTimes(1);
        expect(sendTextMessageFn).not.toHaveBeenCalled();

        notifyEmbeddedMessagingFirstBotMessageSent();

        expect(sendTextMessageFn).toHaveBeenCalledWith('running shoes');
    });

    test('does not send queued message until first-bot event (no timer fallback)', async () => {
        const sendTextMessageFn = vi.fn().mockResolvedValue(undefined);
        const launchChatFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: launchChatFn,
                sendTextMessage: sendTextMessageFn,
            },
            settings: { language: 'en' },
        };

        vi.useFakeTimers();
        try {
            openShopperAgentAndSendMessage('late shoes');

            expect(launchChatFn).toHaveBeenCalledTimes(1);
            expect(sendTextMessageFn).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(60_000);

            expect(sendTextMessageFn).not.toHaveBeenCalled();

            notifyEmbeddedMessagingFirstBotMessageSent();

            expect(sendTextMessageFn).toHaveBeenCalledWith('late shoes');
        } finally {
            vi.useRealTimers();
        }
    });

    test('second search sends immediately after first-bot was seen (no queue, no notify)', () => {
        const sendTextMessageFn = vi.fn().mockResolvedValue(undefined);
        const launchChatFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: launchChatFn,
                sendTextMessage: sendTextMessageFn,
            },
            settings: { language: 'en' },
        };

        openShopperAgentAndSendMessage('first');
        notifyEmbeddedMessagingFirstBotMessageSent();
        expect(sendTextMessageFn).toHaveBeenCalledWith('first');

        expect(launchChatFn).toHaveBeenCalledTimes(1);
        sendTextMessageFn.mockClear();
        launchChatFn.mockClear();

        openShopperAgentAndSendMessage('second');

        expect(launchChatFn).toHaveBeenCalledTimes(1);
        expect(sendTextMessageFn).toHaveBeenCalledWith('second');
    });

    test('sends PDP FAQ-style question after first-bot event', () => {
        const sendTextMessageFn = vi.fn().mockResolvedValue(undefined);
        const launchChatFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: launchChatFn,
                sendTextMessage: sendTextMessageFn,
            },
            settings: { language: 'en' },
        };

        openShopperAgentAndSendMessage('What sizes does this come in?');

        expect(launchChatFn).toHaveBeenCalledTimes(1);
        expect(sendTextMessageFn).not.toHaveBeenCalled();

        notifyEmbeddedMessagingFirstBotMessageSent();

        expect(sendTextMessageFn).toHaveBeenCalledWith('What sizes does this come in?');
    });
});

describe('openShopperAgent', () => {
    const originalBootstrap = window.embeddedservice_bootstrap;

    beforeEach(() => {
        resetShopperAgentSessionStateForTests();
    });

    afterEach(() => {
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = originalBootstrap;
    });

    test('invokes launchChat (embedded utilAPI.launchChat when available)', () => {
        const launchChatFn = vi.fn().mockResolvedValue(undefined);
        (window as Window & { embeddedservice_bootstrap?: unknown }).embeddedservice_bootstrap = {
            init: stubBootstrapInit,
            utilAPI: {
                launchChat: launchChatFn,
                sendTextMessage: vi.fn().mockResolvedValue(undefined),
            },
            settings: { language: 'en' },
        };

        openShopperAgent();

        expect(launchChatFn).toHaveBeenCalledTimes(1);
    });
});
