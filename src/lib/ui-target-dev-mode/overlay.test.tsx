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

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { UITargetDevOverlay } from './overlay';

/**
 * Seed the DOM with marker elements so the overlay's initial `refresh()`
 * call finds hints to render filter buttons for.
 */
function seedMarkers(hints: string[]) {
    hints.forEach((hint) => {
        const el = document.createElement('div');
        el.setAttribute('data-ui-target-hint', hint);
        el.setAttribute('data-ui-target-dev-id', `target-${hint}`);
        document.body.appendChild(el);
    });
}

function clearMarkers() {
    document.querySelectorAll('[data-ui-target-dev-id]').forEach((el) => el.remove());
}

/** Stub MutationObserver so async DOM callbacks never fire outside act(). */
class NoopMutationObserver {
    observe() {}
    disconnect() {}
}

describe('UITargetDevOverlay', () => {
    beforeEach(() => {
        vi.stubGlobal('MutationObserver', NoopMutationObserver);
    });

    afterEach(() => {
        clearMarkers();
        vi.unstubAllGlobals();
    });

    describe('uitarget:collapse-all dispatch', () => {
        test('dispatches uitarget:collapse-all when a hint filter button is clicked', () => {
            seedMarkers(['pr-123']);
            render(<UITargetDevOverlay />);

            const listener = vi.fn();
            document.addEventListener('uitarget:collapse-all', listener);

            act(() => {
                fireEvent.click(screen.getByRole('button', { name: 'pr-123' }));
            });

            expect(listener).toHaveBeenCalledTimes(1);
            document.removeEventListener('uitarget:collapse-all', listener);
        });

        test('dispatches uitarget:collapse-all when Show All is clicked', () => {
            seedMarkers(['pr-123']);
            render(<UITargetDevOverlay />);

            // Activate a filter first so Show All produces a real transition
            act(() => {
                fireEvent.click(screen.getByRole('button', { name: 'pr-123' }));
            });

            const listener = vi.fn();
            document.addEventListener('uitarget:collapse-all', listener);

            act(() => {
                fireEvent.click(screen.getByRole('button', { name: 'Show All' }));
            });

            expect(listener).toHaveBeenCalledTimes(1);
            document.removeEventListener('uitarget:collapse-all', listener);
        });

        test('dispatches uitarget:collapse-all on every filter switch', () => {
            seedMarkers(['pr-123', 'pr-456']);
            render(<UITargetDevOverlay />);

            const listener = vi.fn();
            document.addEventListener('uitarget:collapse-all', listener);

            act(() => {
                fireEvent.click(screen.getByRole('button', { name: 'pr-123' }));
            });
            act(() => {
                fireEvent.click(screen.getByRole('button', { name: 'pr-456' }));
            });

            expect(listener).toHaveBeenCalledTimes(2);
            document.removeEventListener('uitarget:collapse-all', listener);
        });
    });
});
