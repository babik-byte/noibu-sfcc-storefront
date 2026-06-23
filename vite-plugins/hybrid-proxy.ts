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
import { hybridProxyPlugin, shouldRouteToNext } from '@salesforce/storefront-next-dev';

/**
 * Hybrid proxy for local dev against legacy SFRA. Returns false outside development.
 * See docs/README-HYBRID-PROXY.md#custom-route-matching to customize routeMatcher.
 *
 * Env vars:
 * - HYBRID_PROXY_ENABLED: 'true' to enable proxying (string)
 *   Example: HYBRID_PROXY_ENABLED=true
 * - SFCC_ORIGIN: explicit target origin override, highest priority (string, optional)
 *   Example: SFCC_ORIGIN=https://my-sandbox.demandware.net
 * - SCAPI_PROXY_HOST: secondary target origin override (string, optional)
 *   Example: SCAPI_PROXY_HOST=https://internal-proxy.example.com
 * - HYBRID_ROUTING_RULES: routing rules string (string, optional)
 *   Example: HYBRID_ROUTING_RULES='/account/*,/wishlist/*'
 * - HYBRID_PROXY_LOCALE: locale for SFRA path transformation (string, optional)
 *   Priority: HYBRID_PROXY_LOCALE > i18n fallbackLng > 'default' (plugin fallback)
 *   Example: HYBRID_PROXY_LOCALE=en-US
 */
export function hybridProxy({ mode, env }: { mode: string; env: Record<string, string> }) {
    if (mode !== 'development') return false;

    const shortCode = env.PUBLIC__app__commerce__api__shortCode;
    const scapiProxyHost = process.env.SCAPI_PROXY_HOST;

    return hybridProxyPlugin({
        enabled: process.env.HYBRID_PROXY_ENABLED === 'true',
        targetOrigin:
            process.env.SFCC_ORIGIN ||
            scapiProxyHost ||
            (shortCode && `https://${shortCode}.api.commercecloud.salesforce.com`) ||
            '',
        routingRules: process.env.HYBRID_ROUTING_RULES ?? '',
        routeMatcher: shouldRouteToNext,
        defaultSiteId: env.PUBLIC__app__defaultSiteId,
        locale: process.env.HYBRID_PROXY_LOCALE || env.PUBLIC__app__i18n__fallbackLng,
    });
}
