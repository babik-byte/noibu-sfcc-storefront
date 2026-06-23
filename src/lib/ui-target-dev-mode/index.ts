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
 * DEV-ONLY MODULE
 * UITarget development mode utilities.
 * This entire module is excluded from production builds.
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger();

export { UITargetDevMarker } from './marker';

const OVERLAY_CONTAINER_ID = 'ui-target-dev-overlay';

/**
 * Initialize UITarget dev mode overlay.
 * Call this in your app entry point when VITE_UI_TARGET_DEV_MODE=true.
 * Safe to call multiple times — only mounts once.
 */
export async function initUITargetDevMode() {
    // Guard against double-mount (HMR, React strict mode double-effects, etc.)
    if (document.getElementById(OVERLAY_CONTAINER_ID)) {
        return;
    }

    // Lazy-load overlay — NOT statically re-exported to keep this chunk separate
    const { UITargetDevOverlay } = await import('./overlay');

    const container = document.createElement('div');
    container.id = OVERLAY_CONTAINER_ID;
    document.body.appendChild(container);

    const React = await import('react');
    const ReactDOM = await import('react-dom/client');

    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(UITargetDevOverlay));

    logger.debug('UITarget Dev Mode initialized');
}
