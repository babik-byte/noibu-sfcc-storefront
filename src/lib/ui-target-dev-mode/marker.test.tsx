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
import { describe, test, expect, vi } from 'vitest';
import { UITargetDevMarker } from './marker';

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({ warn: vi.fn() }),
}));

describe('UITargetDevMarker', () => {
    describe('expanded panel', () => {
        test('panel is hidden by default', () => {
            render(<UITargetDevMarker targetId="test-target" />);

            expect(screen.queryByRole('heading', { name: 'test-target' })).not.toBeInTheDocument();
        });

        test('panel appears after clicking the badge', () => {
            render(<UITargetDevMarker targetId="test-target" />);

            fireEvent.click(screen.getByTitle('Click for details'));

            expect(screen.getByRole('heading', { name: 'test-target' })).toBeInTheDocument();
        });

        test('panel hides when the close button is clicked', () => {
            render(<UITargetDevMarker targetId="test-target" />);

            fireEvent.click(screen.getByTitle('Click for details'));
            expect(screen.getByRole('heading', { name: 'test-target' })).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: '×' }));
            expect(screen.queryByRole('heading', { name: 'test-target' })).not.toBeInTheDocument();
        });
    });

    describe('uitarget:collapse-all event', () => {
        test('collapses an open panel when the event is dispatched', () => {
            render(<UITargetDevMarker targetId="test-target" />);

            fireEvent.click(screen.getByTitle('Click for details'));
            expect(screen.getByRole('heading', { name: 'test-target' })).toBeInTheDocument();

            act(() => {
                document.dispatchEvent(new CustomEvent('uitarget:collapse-all'));
            });

            expect(screen.queryByRole('heading', { name: 'test-target' })).not.toBeInTheDocument();
        });

        test('is a no-op when the panel is already closed', () => {
            render(<UITargetDevMarker targetId="test-target" />);

            act(() => {
                document.dispatchEvent(new CustomEvent('uitarget:collapse-all'));
            });

            expect(screen.queryByRole('heading', { name: 'test-target' })).not.toBeInTheDocument();
        });

        test('collapses all open panels when multiple markers are rendered', () => {
            render(
                <>
                    <UITargetDevMarker targetId="target-a" />
                    <UITargetDevMarker targetId="target-b" />
                </>
            );

            const badges = screen.getAllByTitle('Click for details');
            fireEvent.click(badges[0]);
            fireEvent.click(badges[1]);

            expect(screen.getByRole('heading', { name: 'target-a' })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'target-b' })).toBeInTheDocument();

            act(() => {
                document.dispatchEvent(new CustomEvent('uitarget:collapse-all'));
            });

            expect(screen.queryByRole('heading', { name: 'target-a' })).not.toBeInTheDocument();
            expect(screen.queryByRole('heading', { name: 'target-b' })).not.toBeInTheDocument();
        });

        test('removes the event listener on unmount', () => {
            const { unmount } = render(<UITargetDevMarker targetId="test-target" />);

            fireEvent.click(screen.getByTitle('Click for details'));
            unmount();

            // After unmount the listener is gone — dispatching must not throw
            act(() => {
                document.dispatchEvent(new CustomEvent('uitarget:collapse-all'));
            });
        });
    });
});
