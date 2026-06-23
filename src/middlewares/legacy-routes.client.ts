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
import type { DataStrategyResult, MiddlewareFunction } from 'react-router';
import { appConfigContext } from '@salesforce/storefront-next-runtime/config';
import { stripPathPrefix } from '@salesforce/storefront-next-runtime/site-context';
import type { AppConfig } from '@/types/config';

/**
 * Client-side middleware that intercepts navigation to legacy routes and forces a full page navigation.
 *
 * This middleware runs before any loaders or components render, checking if the current
 * navigation target is a configured legacy route. If so, it triggers a full page navigation
 * to let the CDN/server handle routing to the legacy backend (e.g., SFRA, SiteGenesis).
 *
 * Configuration:
 * Set `site.hybrid.legacyRoutes` in your config to define which routes should trigger redirects.
 * Supports exact paths, single-segment named params (`:name`), and multi-segment wildcards
 * (`*`) — the latter two follow React Router-style syntax.
 *
 * Example:
 * ```
 * site: {
 *   hybrid: {
 *     enabled: true,
 *     legacyRoutes: [
 *       '/checkout',                          // Exact match
 *       '/account/orders',                    // Exact match
 *       '/product/:id',                       // Single segment: /product/123, /product/abc
 *       '/category/:categoryId/item/:itemId', // Multiple single segments
 *       '/categoryLv1/*',                     // Splat: /categoryLv1/shoes, /categoryLv1/shoes/running
 *       '/category/:cat/*',                   // :param + splat combined
 *       '/files/*-thumb'                      // '*' may appear anywhere, not only trailing
 *     ]
 *   }
 * }
 * ```
 *
 * Note: `/categoryLv1/*` does NOT match the bare `/categoryLv1` (no trailing slash). If you
 * need both, list `/categoryLv1` as a separate exact entry. The bare pattern `'*'` matches any
 * path (catch-all).
 *
 * Flow:
 * 1. User clicks <Link to="/checkout">
 * 2. React Router begins client-side navigation
 * 3. This middleware checks if /checkout matches any pattern in legacyRoutes
 * 4. If yes → adds ?redirected=1 and navigates → server/CDN handles routing
 * 5. If no → continue normal client-side navigation
 */

// Cache compiled regex patterns to avoid recreating them on every navigation
const regexCache = new Map<string, RegExp>();

/**
 * Converts a route pattern with parameters and/or wildcards into a RegExp.
 *
 * Supports:
 * - React Router style named params: ':id' matches a single path segment ([^/]+)
 * - Splat wildcard: '*' matches any path content, including '/' (.*)
 *
 * @param pattern - Route pattern like '/product/:id', '/categoryLv1/*', or '/category/:cat/*'
 * @returns RegExp that matches the pattern
 */
function routePatternToRegex(pattern: string): RegExp {
    // Escape regex specials except '*', which is treated as a wildcard below
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const withParams = escaped.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '([^/]+)');
    const withWildcards = withParams.replace(/\*/g, '.*');
    return new RegExp(`^${withWildcards}$`);
}

/**
 * Checks if a pathname matches a route pattern.
 * Supports exact matches, parameterized routes, and wildcard splats.
 *
 * @param pathname - The pathname to check (e.g., '/product/123')
 * @param pattern - The route pattern (e.g., '/product/:id', '/categoryLv1/*', or '/checkout')
 * @returns true if the pathname matches the pattern
 */
export function matchesRoutePattern(pathname: string, pattern: string): boolean {
    // If pattern has no params or wildcards, do a fast exact-string match
    if (!pattern.includes(':') && !pattern.includes('*')) {
        return pathname === pattern;
    }

    // Check the regex cache first to avoid recreating RegExp objects
    let regex = regexCache.get(pattern);
    if (!regex) {
        regex = routePatternToRegex(pattern);
        regexCache.set(pattern, regex);
    }

    return regex.test(pathname);
}

const legacyRoutesMiddleware: MiddlewareFunction<Record<string, DataStrategyResult>> = async (
    { request, context },
    next
) => {
    // Only run on client-side
    if (typeof window === 'undefined') {
        return next();
    }

    const config = context.get(appConfigContext) as AppConfig | undefined;
    const enabled = config?.hybrid?.enabled ?? false;
    const legacyRoutes = config?.hybrid?.legacyRoutes;

    // If hybrid mode is disabled or no legacy routes configured, skip
    if (!enabled || !legacyRoutes || legacyRoutes.length === 0) {
        return next();
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const hasRedirected = url.searchParams.get('redirected') === '1';

    // If already redirected once, let React Router handle it (will show 404 or error boundary)
    if (hasRedirected) {
        return next();
    }

    // Normalize the pathname by stripping the site context prefix before matching.
    //
    // When the url prefix is other than '/', every subpage URL is prefixed accordingly to the
    // config (e.g. '/checkout' → '/global/en-GB/checkout'). Without stripping, the incoming
    // pathname would never match the bare paths configured in legacyRoutes. Stripping early
    // normalizes the URL so the matching logic always operates on functional paths rather than
    // URL variations.
    //
    // Why this approach:
    // - No config bloat: '/cart' is defined once — you don't need a separate entry for every
    //   site/locale permutation (e.g. '/global/en-GB/cart', '/us/en-US/cart').
    // - Consistency: uses the same normalized path that ecdn-matcher and the runtime use.
    // - Centralized strategy: the prefix pattern comes from config.url.prefix, so changing
    //   your URL strategy (e.g. '/:siteId/:localeId' → '/:localeId') requires only one
    //   update — the legacyRoutes list stays untouched.
    const urlPrefix = config?.url?.prefix ?? '';
    const strippedPathname = stripPathPrefix({ pathname, prefix: urlPrefix }) || '/';
    const isLegacyRoute = legacyRoutes.some((legacyRoute) => matchesRoutePattern(strippedPathname, legacyRoute));

    if (isLegacyRoute) {
        // Navigate to the stripped pathname so the legacy backend (or local hybrid proxy)
        // can apply its own site/locale prefix without doubling up on storefront-next's.
        // Without this, '/global/en-GB/cart' would be handed to the proxy, which prepends
        // its own SFRA prefix and produces '/s/{siteId}/{locale}/global/en-GB/cart' — a 404.
        const legacyUrl = new URL(strippedPathname, url.origin);
        legacyUrl.search = url.search;
        legacyUrl.hash = url.hash;
        // Add redirected=1 to prevent infinite loops
        legacyUrl.searchParams.set('redirected', '1');

        // Force a full page navigation to hit the server/CDN
        // The CDN routing rules or server middleware will handle routing to the legacy backend
        window.location.href = legacyUrl.toString();

        // Suspend indefinitely while the browser navigates away.
        // Returning an empty object would cause React Router to error with
        // "No result returned from dataStrategy" since it expects a DataStrategyResult
        // for every matched route. This never-resolving promise keeps React Router
        // waiting until the page unloads. It's zero-cost (no timers or listeners)
        // and is garbage collected when the browser completes the navigation.
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return new Promise(() => {});
    }

    // Not a legacy route, continue with normal client-side navigation
    return next();
};

export default legacyRoutesMiddleware;
