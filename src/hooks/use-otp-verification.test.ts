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

import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { useOtpVerification } from './use-otp-verification';

describe('useOtpVerification', () => {
    const mockOnVerify = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('return value shape', () => {
        test('returns otpInputs, otpInputsRef, and refCallbacks', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 6, onVerify: mockOnVerify }));

            expect(result.current.otpInputs).toBeDefined();
            expect(result.current.otpInputsRef).toBeDefined();
            expect(result.current.refCallbacks).toBeDefined();
        });

        test('refCallbacks has the correct length matching otpLength', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 6, onVerify: mockOnVerify }));

            expect(result.current.refCallbacks).toHaveLength(6);
        });

        test('refCallbacks length matches different otpLength values', () => {
            const { result: result4 } = renderHook(() => useOtpVerification({ otpLength: 4, onVerify: mockOnVerify }));
            const { result: result8 } = renderHook(() => useOtpVerification({ otpLength: 8, onVerify: mockOnVerify }));

            expect(result4.current.refCallbacks).toHaveLength(4);
            expect(result8.current.refCallbacks).toHaveLength(8);
        });

        test('each refCallback is a function', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 6, onVerify: mockOnVerify }));

            result.current.refCallbacks.forEach((cb: (el: HTMLInputElement | null) => void) => {
                expect(typeof cb).toBe('function');
            });
        });

        test('otpInputsRef.current is in sync with otpInputs', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 6, onVerify: mockOnVerify }));

            expect(result.current.otpInputsRef.current).toBe(result.current.otpInputs);
        });
    });

    describe('refCallbacks', () => {
        test('refCallback assigns element to inputRefs at the correct index', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 4, onVerify: mockOnVerify }));

            const mockEl0 = document.createElement('input');
            const mockEl2 = document.createElement('input');

            act(() => {
                result.current.refCallbacks[0](mockEl0);
                result.current.refCallbacks[2](mockEl2);
            });

            expect(result.current.otpInputs.inputRefs.current[0]).toBe(mockEl0);
            expect(result.current.otpInputs.inputRefs.current[1]).toBeNull();
            expect(result.current.otpInputs.inputRefs.current[2]).toBe(mockEl2);
        });

        test('refCallback accepts null (unmount cleanup)', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 4, onVerify: mockOnVerify }));

            const mockEl = document.createElement('input');

            act(() => {
                result.current.refCallbacks[0](mockEl);
            });
            expect(result.current.otpInputs.inputRefs.current[0]).toBe(mockEl);

            act(() => {
                result.current.refCallbacks[0](null);
            });
            expect(result.current.otpInputs.inputRefs.current[0]).toBeNull();
        });

        test('refCallbacks array is stable across re-renders when otpLength does not change', () => {
            const { result, rerender } = renderHook(
                ({ onVerify }: { onVerify: (code: string) => void }) => useOtpVerification({ otpLength: 6, onVerify }),
                { initialProps: { onVerify: mockOnVerify } }
            );

            const firstCallbacks = result.current.refCallbacks;

            rerender({ onVerify: vi.fn() });

            expect(result.current.refCallbacks).toBe(firstCallbacks);
        });

        test('refCallbacks array is recreated when otpLength changes', () => {
            const { result, rerender } = renderHook(
                ({ otpLength }: { otpLength: number }) => useOtpVerification({ otpLength, onVerify: mockOnVerify }),
                { initialProps: { otpLength: 4 } }
            );

            const firstCallbacks = result.current.refCallbacks;

            rerender({ otpLength: 6 });

            expect(result.current.refCallbacks).not.toBe(firstCallbacks);
            expect(result.current.refCallbacks).toHaveLength(6);
        });
    });

    describe('onVerify callback', () => {
        test('calls onVerify when all digits are entered', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 4, onVerify: mockOnVerify }));

            act(() => {
                result.current.otpInputs.setValue(0, '1');
                result.current.otpInputs.setValue(1, '2');
                result.current.otpInputs.setValue(2, '3');
                result.current.otpInputs.setValue(3, '4');
            });

            act(() => {
                vi.runAllTimers();
            });

            expect(mockOnVerify).toHaveBeenCalledWith('1234');
        });

        test('does not call onVerify when code is incomplete', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 4, onVerify: mockOnVerify }));

            act(() => {
                result.current.otpInputs.setValue(0, '1');
                result.current.otpInputs.setValue(1, '2');
            });

            act(() => {
                vi.runAllTimers();
            });

            expect(mockOnVerify).not.toHaveBeenCalled();
        });

        test('uses the latest onVerify if it changes between renders', () => {
            const firstVerify = vi.fn();
            const secondVerify = vi.fn();

            const { result, rerender } = renderHook(
                ({ onVerify }: { onVerify: (code: string) => void }) => useOtpVerification({ otpLength: 4, onVerify }),
                { initialProps: { onVerify: firstVerify } }
            );

            rerender({ onVerify: secondVerify });

            act(() => {
                result.current.otpInputs.setValue(0, '1');
                result.current.otpInputs.setValue(1, '2');
                result.current.otpInputs.setValue(2, '3');
                result.current.otpInputs.setValue(3, '4');
            });

            act(() => {
                vi.runAllTimers();
            });

            expect(firstVerify).not.toHaveBeenCalled();
            expect(secondVerify).toHaveBeenCalledWith('1234');
        });
    });

    describe('otpInputs passthrough', () => {
        test('exposes values array initialized to empty strings', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 4, onVerify: mockOnVerify }));

            expect(result.current.otpInputs.values).toEqual(['', '', '', '']);
        });

        test('clear resets all values', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 4, onVerify: mockOnVerify }));

            act(() => {
                result.current.otpInputs.setValue(0, '5');
                result.current.otpInputs.setValue(1, '6');
            });

            act(() => {
                result.current.otpInputs.clear();
            });

            expect(result.current.otpInputs.values).toEqual(['', '', '', '']);
        });

        test('setValue returns the assembled code string', () => {
            const { result } = renderHook(() => useOtpVerification({ otpLength: 4, onVerify: mockOnVerify }));

            let code: string | null = null;
            act(() => {
                result.current.otpInputs.setValue(0, '7');
                code = result.current.otpInputs.setValue(1, '8');
            });

            expect(code).toBe('78');
        });
    });
});
