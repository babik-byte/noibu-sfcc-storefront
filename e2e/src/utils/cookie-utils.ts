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

const { I } = inject();

/**
 * Storefront base URL (origin) for cookie domain scoping.
 * Storefront proxies may reach external APIs that set cookies; assertions must
 * only consider cookies scoped to the storefront domain to avoid false results.
 */
export function getStorefrontOrigin(): string {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    try {
        return new URL(baseUrl).origin;
    } catch {
        return baseUrl;
    }
}

/**
 * Get cookies scoped to the storefront domain only.
 * Uses Playwright context.cookies(url) with the current page origin to exclude
 * cookies from external API proxies. Prefers the current page URL so we scope
 * to the domain we're actually on after redirects (e.g. post-login).
 */
export async function getStorefrontScopedCookies(): Promise<Map<string, string>> {
    const fallbackOrigin = getStorefrontOrigin();
    const cookies = await (I.usePlaywrightTo('get storefront-scoped cookies', async ({ page }) => {
        // Wait for page to be in a stable state before reading cookies
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {
            // Ignore timeout - page might already be loaded
        });
        const pageUrl = page.url();
        const origin = pageUrl && !pageUrl.startsWith('about:') ? new URL(pageUrl).origin : fallbackOrigin;
        return await page.context().cookies(origin);
    }) as unknown as Promise<Array<{ name: string; value: string; path?: string }>>);
    const map = new Map<string, string>();
    for (const c of cookies ?? []) {
        const existing = map.get(c.name);
        // Prefer cookie with path '/' when duplicates exist (session cookies)
        if (!existing || c.path === '/') {
            map.set(c.name, c.value);
        }
    }
    return map;
}
