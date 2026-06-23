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
 * Production gate for PDP FAQ and the account Need Help **Ask a question** button.
 * Header sparkles and search assistant ignore this module — they only use valid `commerceAgent` config.
 *
 * Storybook resolves this module to `.storybook/shims/shopper-agent-context-ui.ts` via Vite alias (see
 * `.storybook/vite.config.ts` and `.storybook/README-STORYBOOK.md`) so stories show those surfaces without
 * editing this constant.
 */
export const SHOPPER_AGENT_CONTEXT_UI_ENABLED = false;

/**
 * Whether PDP FAQ should mount and whether Account Help should show **Ask a question**.
 */
export function isShopperAgentContextUiEnabled(): boolean {
    return SHOPPER_AGENT_CONTEXT_UI_ENABLED;
}
