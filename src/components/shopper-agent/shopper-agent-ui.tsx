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
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import { resolvePrefix } from '@salesforce/storefront-next-runtime/site-context';
import { useCurrentSiteAndLocaleRef } from '@/hooks/use-current-site-and-locale-ref';
import { ShopperAgentWindow } from './shopper-agent-window';
import { validateShopperAgentConfig, type ShopperAgentConfig } from './shopper-agent.utils';

/**
 * TypeScript declarations for Salesforce Embedded Messaging
 * @see https://developer.salesforce.com/docs/service/messaging-web/guide/embedded-messaging-api.html
 */
declare global {
    interface Window {
        embeddedservice_bootstrap: {
            settings: {
                language: string;
                hideChatButtonOnLoad?: boolean;
            };
            init: (orgId: string, deploymentName: string, siteUrl: string, options: { scrt2URL: string }) => void;
            utilAPI?: {
                launchChat: () => Promise<void>;
                sendTextMessage: (message: string) => Promise<void>;
                showChatButton?: () => void;
            };
            prechatAPI?: {
                setHiddenPrechatFields: (fields: Record<string, string>) => void;
            };
        };
    }
}

interface ShopperAgentUIProps {
    commerceAgentConfiguration?: ShopperAgentConfig;
    locale: string;
    currency?: string;
    userId?: string;
    usid?: string;
}

/**
 * Shopper Agent UI chunk – loads Embedded Messaging script and mounts the chat window.
 * Loaded after first paint via preload + requestAnimationFrame so it stays off the critical path.
 */
export default function ShopperAgentUI({
    commerceAgentConfiguration,
    locale,
    currency,
    userId,
    usid,
}: ShopperAgentUIProps) {
    const config = useConfig();
    const { siteRef, localeRef } = useCurrentSiteAndLocaleRef();

    if (!validateShopperAgentConfig(commerceAgentConfiguration)) {
        return null;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const prefix = config.url?.prefix
        ? resolvePrefix({ prefix: config.url.prefix, params: { siteId: siteRef, localeId: localeRef } })
        : '';
    const domainUrl = `${origin}${prefix}`;

    return (
        <div data-testid="shopper-agent">
            <ShopperAgentWindow
                config={commerceAgentConfiguration}
                locale={locale}
                currency={currency}
                siteId={commerceAgentConfiguration.siteId}
                userId={userId}
                usid={usid}
                domainUrl={domainUrl}
            />
        </div>
    );
}
