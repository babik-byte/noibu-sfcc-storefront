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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { uiTargetDevModePlugin } from '@salesforce/storefront-next-dev';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadHintMap(): Record<string, string> {
    try {
        const configPath = resolve(__dirname, '../src/extensions/ui-target-smoke-test/target-config.json');
        const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as {
            components: { targetId: string; hint?: string }[];
        };
        return Object.fromEntries(raw.components.filter((c) => c.hint).map((c) => [c.targetId, c.hint as string]));
    } catch {
        return {};
    }
}

/**
 * UITarget dev-mode visual overlay. MUST run before `storefrontNext()` so its
 * markers are present when the target system processes extension transforms.
 *
 * `hintMap` is omitted from the SDK's compiled `.d.ts` by rollup-plugin-dts,
 * so we cast at the call site.
 *
 * Env vars:
 * - VITE_UI_TARGET_DEV_MODE: 'true' enables the overlay (string)
 *   Example: VITE_UI_TARGET_DEV_MODE=true
 * - VITE_TARGET_FILTER_CATEGORY: optional category filter (string, optional)
 *   Example: VITE_TARGET_FILTER_CATEGORY=product
 */
export function uiTargetDevMode() {
    return uiTargetDevModePlugin({
        enabled: process.env.VITE_UI_TARGET_DEV_MODE === 'true',
        filterCategory: process.env.VITE_TARGET_FILTER_CATEGORY,
        hintMap: loadHintMap(),
    } as Parameters<typeof uiTargetDevModePlugin>[0]);
}
