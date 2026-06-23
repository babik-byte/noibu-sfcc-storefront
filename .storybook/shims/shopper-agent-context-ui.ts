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

/**
 * Storybook-only shim: Vite aliases `@/lib/shopper-context/agent-ui` to this file when building Storybook.
 * Keeps production bundles free of Storybook/test branching. See `.storybook/README-STORYBOOK.md`.
 */
export const SHOPPER_AGENT_CONTEXT_UI_ENABLED = false;

export function isShopperAgentContextUiEnabled(): boolean {
    return true;
}
