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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// eslint-disable-next-line import/no-namespace -- vi.spyOn requires namespace import
import * as ReactRouter from 'react-router';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { resourceRoutes } from '@/route-paths';
import OtpModal from './otp-modal';

const mockSubmit = vi.fn();

function renderModal(props: Partial<React.ComponentProps<typeof OtpModal>> = {}) {
    const router = createMemoryRouter(
        [
            {
                path: '*',
                element: (
                    <AllProvidersWrapper>
                        <OtpModal
                            isOpen={true}
                            email="test@example.com"
                            onClose={vi.fn()}
                            onSuccess={vi.fn()}
                            otpLength={6}
                            {...props}
                        />
                    </AllProvidersWrapper>
                ),
            },
        ],
        { initialEntries: ['/'] }
    );
    return render(<RouterProvider router={router} />);
}

describe('OtpModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(ReactRouter, 'useFetcher').mockReturnValue({
            submit: mockSubmit,
            state: 'idle',
            data: undefined,
        } as any);
    });

    describe('visibility', () => {
        it('renders dialog when isOpen is true', () => {
            renderModal();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('does not render dialog when isOpen is false', () => {
            renderModal({ isOpen: false });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('submission', () => {
        it('submits email and otpCode in form data', async () => {
            const user = userEvent.setup();
            renderModal();

            const inputs = screen.getAllByRole('textbox');
            for (const input of inputs) {
                await user.type(input, '1');
            }

            expect(mockSubmit).toHaveBeenCalled();
            const [formData] = mockSubmit.mock.calls[0] as [FormData];
            expect(formData.get('email')).toBe('test@example.com');
            expect(formData.get('otpCode')).toBe('111111');
        });
    });

    describe('verifyActionUrl', () => {
        it('submits to /action/verify-passwordless-otp by default', async () => {
            const user = userEvent.setup();
            renderModal();

            const inputs = screen.getAllByRole('textbox');
            for (const input of inputs) {
                await user.type(input, '1');
            }

            expect(mockSubmit).toHaveBeenCalledWith(
                expect.any(FormData),
                expect.objectContaining({ method: 'POST', action: resourceRoutes.verifyPasswordlessOtp })
            );
        });

        it('submits to custom verifyActionUrl when provided', async () => {
            const user = userEvent.setup();
            renderModal({ verifyActionUrl: '/action/verify-signup-otp' });

            const inputs = screen.getAllByRole('textbox');
            for (const input of inputs) {
                await user.type(input, '1');
            }

            expect(mockSubmit).toHaveBeenCalledWith(
                expect.any(FormData),
                expect.objectContaining({ method: 'POST', action: '/action/verify-signup-otp' })
            );
        });
    });
});
