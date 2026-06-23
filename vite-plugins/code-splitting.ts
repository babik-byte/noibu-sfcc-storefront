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
import type { Plugin } from 'vite';

/**
 * Code-splitting policy for the production build.
 *
 * Defines which code domains ship as their own async chunk so that route
 * bundles stay lean and infrequently-visited flows don't bloat the main bundle.
 *
 * Rules:
 * - `checkout-components`: the checkout flow is heavy and only loaded once
 *   per session; isolating it keeps it out of route bundles.
 */
export function codeSplitting(): Plugin {
    return {
        name: 'template:code-splitting',
        config(viteConfig) {
            const output = viteConfig.build?.rollupOptions?.output;
            if (Array.isArray(output)) return;
            const existingManualChunks = output?.manualChunks;

            return {
                build: {
                    rollupOptions: {
                        output: {
                            manualChunks(id, meta) {
                                if (id.includes('/src/components/checkout/') && !id.includes('.test.')) {
                                    return 'checkout-components';
                                }
                                if (typeof existingManualChunks === 'function') {
                                    return existingManualChunks.call(this, id, meta);
                                }
                                if (existingManualChunks && typeof existingManualChunks === 'object') {
                                    for (const [name, ids] of Object.entries(existingManualChunks)) {
                                        if (ids.includes(id)) return name;
                                    }
                                }
                            },
                        },
                    },
                },
            };
        },
    };
}
