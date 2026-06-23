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
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { SHOPPER_AGENT_LOAD_EVENT, type ShopperAgentConfig } from './shopper-agent.utils';

const ShopperAgentUI = lazy(() => import('./shopper-agent-ui'));

/** Re-export for consumers that need to listen for load trigger. */
// eslint-disable-next-line react-refresh/only-export-components -- barrel re-export for load trigger
export { SHOPPER_AGENT_LOAD_EVENT };

const IDLE_TIMEOUT_MS = 2000;

/** requestIdleCallback with fallback for browsers that don't support it (e.g. older Safari). */
function scheduleIdle(callback: IdleRequestCallback, options?: IdleRequestOptions): number {
    if (typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS, ...options });
    }
    return window.setTimeout(
        () => callback({ didTimeout: true, timeRemaining: () => 0 }),
        options?.timeout ?? IDLE_TIMEOUT_MS
    ) as unknown as number;
}

function cancelIdle(handle: number): void {
    if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(handle);
    } else {
        clearTimeout(handle);
    }
}

interface ShopperAgentProps {
    commerceAgentConfiguration?: ShopperAgentConfig;
    locale: string;
    currency?: string;
    userId?: string;
    usid?: string;
}

/**
 * ShopperAgent wrapper: defers loading the agent chunk until the browser is idle via
 * requestIdleCallback, so the main thread's initial hydration is not blocked. The chunk
 * (and Embedded Service script) preload in the background; on user interaction (e.g. "Open chat")
 * the agent is typically ready. If the user clicks before idle has fired, we load on demand
 * and cancel the scheduled idle callback.
 */
function ShopperAgent({ commerceAgentConfiguration, locale, currency, userId, usid }: ShopperAgentProps) {
    const [deferReady, setDeferReady] = useState(false);
    const idleHandleRef = useRef<number | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let cancelled = false;

        const startLoad = (): void => {
            if (cancelled) return;
            if (idleHandleRef.current != null) {
                cancelIdle(idleHandleRef.current);
                idleHandleRef.current = null;
            }
            void import('./shopper-agent-ui');
            if (!cancelled) setDeferReady(true);
        };

        idleHandleRef.current = scheduleIdle(
            () => {
                idleHandleRef.current = null;
                startLoad();
            },
            { timeout: IDLE_TIMEOUT_MS }
        );

        const handleLoadEvent = (): void => {
            startLoad();
        };
        window.addEventListener(SHOPPER_AGENT_LOAD_EVENT, handleLoadEvent);

        return () => {
            cancelled = true;
            if (idleHandleRef.current != null) {
                cancelIdle(idleHandleRef.current);
                idleHandleRef.current = null;
            }
            window.removeEventListener(SHOPPER_AGENT_LOAD_EVENT, handleLoadEvent);
        };
    }, []);

    if (!deferReady) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <ShopperAgentUI
                commerceAgentConfiguration={commerceAgentConfiguration}
                locale={locale}
                currency={currency}
                userId={userId}
                usid={usid}
            />
        </Suspense>
    );
}

export default ShopperAgent;

/* eslint-disable react-refresh/only-export-components -- default component plus intentional util barrel re-exports */
export {
    launchChat,
    sendTextMessage,
    openShopperAgent,
    openShopperAgentAndSendMessage,
    notifyEmbeddedMessagingFirstBotMessageSent,
} from './shopper-agent.utils';

export type { ShopperAgentConfig } from './shopper-agent.utils';
/* eslint-enable react-refresh/only-export-components */
