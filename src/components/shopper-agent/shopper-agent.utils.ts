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

import { createLogger } from '@/lib/logger';

const logger = createLogger();

/** Custom event to trigger Shopper Agent chunk load when user interacts before idle (e.g. clicks Open chat). */
export const SHOPPER_AGENT_LOAD_EVENT = 'shopper-agent:load';

/** Set when user clicked Open chat before utilAPI was ready; cleared when we open on ready. */
let pendingOpenWhenReady = false;

/**
 * When set, {@link sendTextMessage} is invoked when Embedded Messaging fires `onEmbeddedMessagingFirstBotMessageSent`.
 * After the session is marked ready, further opens with initial text (search, PDP FAQ, etc.) send immediately instead of this queue.
 */
let pendingSearchMessageAfterFirstBot: string | null = null;

/**
 * After Embedded Messaging has fired `onEmbeddedMessagingFirstBotMessageSent` once, the event often does not fire
 * again in the same conversation — so further opens with initial text send immediately instead of waiting on this queue.
 */
let isEmbeddedMessagingConversationReadyForAutoSend = false;

/** Returns true if launch was requested before ready and clears the flag. Used by ShopperAgentWindow to open chat once ready. */
export function getAndClearPendingOpen(): boolean {
    const value = pendingOpenWhenReady;
    pendingOpenWhenReady = false;
    return value;
}
/**
 * Invoked from {@link ShopperAgentWindow} when Embedded Messaging dispatches
 * `onEmbeddedMessagingFirstBotMessageSent` — after the first bot/welcome message in a conversation.
 */
export function notifyEmbeddedMessagingFirstBotMessageSent(): void {
    isEmbeddedMessagingConversationReadyForAutoSend = true;
    if (!pendingSearchMessageAfterFirstBot) {
        return;
    }
    const msg = pendingSearchMessageAfterFirstBot;
    pendingSearchMessageAfterFirstBot = null;
    sendTextMessage(msg);
}

/**
 * Resets module state for tests.
 * @internal
 */
export function resetShopperAgentSessionStateForTests(): void {
    pendingOpenWhenReady = false;
    pendingSearchMessageAfterFirstBot = null;
    isEmbeddedMessagingConversationReadyForAutoSend = false;
}

/** Allowed Salesforce hostname suffixes; subdomains (e.g. *.salesforce.com) are allowed via .${domain} check. */
const TRUSTED_SALESFORCE_DOMAINS = [
    'salesforce.com',
    'salesforce-scrt.com',
    'pc-rnd.salesforce-scrt.com',
    'pc-rnd.site.com',
    'my.site.com',
];

/**
 * Validates that a URL is from a trusted Salesforce domain.
 * Uses exact match or "ends with dot + domain" to avoid subdomain takeover
 * (e.g. salesforce.com.attacker.com must not match).
 *
 * @param url - The URL to validate (e.g., 'https://myorg.salesforce.com/script.js')
 * @returns True if the URL is from a trusted Salesforce domain, false otherwise
 */
export const validateSalesforceDomain = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        return TRUSTED_SALESFORCE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
};

export interface ShopperAgentConfig {
    enabled: string;
    embeddedServiceName: string;
    embeddedServiceEndpoint: string;
    scriptSourceUrl: string;
    scrt2Url: string;
    salesforceOrgId: string;
    siteId: string;
    enableConversationContext?: string;
    conversationContext?: string[];
}

/**
 * Validates the shopper agent configuration object to ensure all required fields
 * are present and valid before initializing the embedded messaging service.
 *
 * @param config - Shopper agent configuration object
 * @returns True if configuration is valid, false otherwise
 */
export const validateShopperAgentConfig = (config: unknown): config is ShopperAgentConfig => {
    if (!config || typeof config !== 'object') {
        logger.error('Configuration must be an object.');
        return false;
    }

    const typedConfig = config as Record<string, unknown>;

    const requiredFields = [
        'enabled',
        'embeddedServiceName',
        'embeddedServiceEndpoint',
        'scriptSourceUrl',
        'scrt2Url',
        'salesforceOrgId',
        'siteId',
    ];

    const isRequiredFieldValid = (key: string): boolean => {
        const value = typedConfig[key];
        if (key === 'enabled') {
            return value === true || (typeof value === 'string' && value.trim() !== '');
        }
        return typeof value === 'string' && value.trim() !== '';
    };

    const isValid = requiredFields.every(isRequiredFieldValid);

    if (!isValid) {
        logger.error('Invalid configuration - missing or empty required fields.');
        return false;
    }

    // Validate optional conversation context properties if present
    if (typedConfig.enableConversationContext !== undefined) {
        if (typeof typedConfig.enableConversationContext !== 'string') {
            logger.error('enableConversationContext must be a string.');
            return false;
        }
    }

    if (typedConfig.conversationContext !== undefined) {
        if (!Array.isArray(typedConfig.conversationContext)) {
            logger.error('conversationContext must be an array.');
            return false;
        }
    }

    // Add domain validation for script URL
    if (typedConfig.scriptSourceUrl) {
        const isTrustedDomain = validateSalesforceDomain(typedConfig.scriptSourceUrl as string);
        if (!isTrustedDomain) {
            logger.error('Script URL must be from a trusted Salesforce domain.');
            return false;
        }
    }

    return true;
};

/**
 * Checks if the shopper agent is enabled and running in a browser environment.
 *
 * @param enabled - Enabled state (string 'true' or boolean true from config/env)
 * @returns True if enabled is truthy and running on client, false otherwise
 */
export const isShopperAgentEnabled = (enabled: string | boolean): boolean => {
    return (enabled === 'true' || enabled === true) && typeof window !== 'undefined';
};

const onClient = typeof window !== 'undefined';

const LAUNCH_DELAY_MS = 150;

/**
 * Opens the shopper agent and optionally sends initial FAQ (or other) text: with an empty message, only {@link launchChat}.
 * With text: once the first-bot event has fired, {@link launchChat} then {@link sendTextMessage} run immediately;
 * otherwise the text is queued for `onEmbeddedMessagingFirstBotMessageSent`.
 *
 * Use from PDP “Ask assistant” FAQ questions, or any entry that prefills chat with a question string.
 */
export function openShopperAgentAndSendMessage(message: string): void {
    if (!onClient) {
        return;
    }

    const trimmedMsg = message.trim();
    launchChat();

    if (!trimmedMsg) {
        return;
    }

    if (isEmbeddedMessagingConversationReadyForAutoSend) {
        sendTextMessage(trimmedMsg);
        return;
    }

    pendingSearchMessageAfterFirstBot = trimmedMsg;
}

/**
 * Launch the chat using the embedded service bootstrap API.
 *
 * When the floating chat button is hidden (hideChatButtonOnLoad=true), this first
 * shows the button via utilAPI.showChatButton() then launches the chat. A short
 * delay is only applied when opening from the "pending ready" path (user clicked
 * before script was ready), so the widget has time to create the button DOM.
 *
 * Pending initial message (if any) is sent from {@link notifyEmbeddedMessagingFirstBotMessageSent};
 * see {@link openShopperAgentAndSendMessage}.
 *
 * @param options.fromPendingReady - True when called from the embedded messaging ready
 *   callback after a prior click; enables a short delay to avoid "Default chat button isn't present".
 */
export function launchChat(options?: { fromPendingReady?: boolean }): void {
    if (!onClient) return;

    try {
        const utilAPI = window.embeddedservice_bootstrap?.utilAPI;
        if (!utilAPI) {
            logger.warn('utilAPI not available');
            pendingOpenWhenReady = true;
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(SHOPPER_AGENT_LOAD_EVENT));
            }
            return;
        }

        const hideChatButtonOnLoad = window.embeddedservice_bootstrap?.settings?.hideChatButtonOnLoad === true;
        const needDelay = options?.fromPendingReady === true;

        if (hideChatButtonOnLoad && typeof utilAPI.showChatButton === 'function') {
            utilAPI.showChatButton();
            if (needDelay) {
                setTimeout(() => {
                    if (typeof utilAPI.launchChat === 'function') {
                        void utilAPI.launchChat();
                    }
                }, LAUNCH_DELAY_MS);
            } else if (typeof utilAPI.launchChat === 'function') {
                void utilAPI.launchChat();
            }
        } else if (typeof utilAPI.launchChat === 'function') {
            void utilAPI.launchChat();
        }
    } catch (error) {
        logger.error('Error launching chat', { error });
    }
}

/**
 * Send a text message to the chat
 *
 * Programmatically sends a message using the embedded messaging utilAPI.
 * The message will appear in the chat window as if the user typed it.
 *
 * @param message - The message text to send
 * @returns void
 */
export function sendTextMessage(message: string): void {
    if (!onClient) {
        logger.warn('sendTextMessage called on server side');
        return;
    }

    try {
        const utilAPI = window.embeddedservice_bootstrap?.utilAPI;
        if (!utilAPI?.sendTextMessage) {
            logger.warn('utilAPI.sendTextMessage not available');
            return;
        }

        void utilAPI.sendTextMessage(message);
    } catch (error) {
        logger.error('Error sending text message', { error });
    }
}

/**
 * Open the shopper agent chat window
 *
 * Programmatically opens the embedded messaging widget.
 * This is a convenience wrapper around launchChat().
 *
 * @returns void
 */
export function openShopperAgent(): void {
    if (!onClient) return;

    try {
        launchChat();
    } catch (error) {
        logger.error('Error opening agent', { error });
    }
}
