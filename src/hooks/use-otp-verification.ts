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
import { useRef } from 'react';
import { useOtpInputs } from '@/hooks/use-otp-inputs';

interface UseOtpVerificationOptions {
    otpLength: number;
    onVerify: (code: string) => void;
}

export function useOtpVerification({ otpLength, onVerify }: UseOtpVerificationOptions) {
    const onVerifyRef = useRef(onVerify);
    onVerifyRef.current = onVerify;

    const otpInputs = useOtpInputs(otpLength, (code) => {
        if (code.length === otpLength) {
            onVerifyRef.current(code);
        }
    });

    const otpInputsRef = useRef(otpInputs);
    otpInputsRef.current = otpInputs;

    const inputRefsStable = useRef(otpInputs.inputRefs);
    inputRefsStable.current = otpInputs.inputRefs;

    const refCallbacks = useRef<Array<(el: HTMLInputElement | null) => void> | null>(null);
    if (!refCallbacks.current || refCallbacks.current.length !== otpLength) {
        refCallbacks.current = Array.from({ length: otpLength }, (_, index) => {
            return (el: HTMLInputElement | null) => {
                inputRefsStable.current.current[index] = el;
            };
        });
    }

    return {
        otpInputs,
        otpInputsRef,
        refCallbacks: refCallbacks.current,
    };
}
