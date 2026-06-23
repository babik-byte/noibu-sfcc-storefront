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
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useFetcher } from 'react-router';
import { useTranslation } from 'react-i18next';
const OtpModal = lazy(() => import('@/components/login/otp-modal'));
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useBasket } from '@/providers/basket';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import type { ShopperLogin } from '@/scapi';
import { TurnstileWidget } from '@/components/security/turnstile-widget';
import type { AppConfig } from '@/types/config';
import { getTurnstileSiteKey, getTurnstileMode, isTurnstileEnabled } from '@/lib/turnstile/utils';
import type {
    action as initiateRegistrationAction,
    InitiateRegistrationResponse,
} from '@/routes/action.initiate-checkout-registration';
import { resourceRoutes } from '@/route-paths';

interface RegisterCustomerSelectionProps {
    /** Callback when checkbox state changes - receives boolean value */
    onSaved?: (shouldCreateAccount: boolean) => void;
    /** Callback when OTP verification succeeds */
    onRegistrationSuccess?: () => void;
    /** Whether the user opted to save their payment method */
    savePaymentToProfile?: boolean;
    /** Optional toast callback to avoid bundling sonner in this lazy chunk */
    showToast?: (message: string, type: 'success' | 'error', options?: { duration?: number }) => void;
    /** Initial checked state — used in Storybook to show the expanded description without triggering fetcher logic */
    defaultChecked?: boolean;
    /** Initial account created state — used in Storybook to show the confirmation banner without triggering OTP logic */
    defaultAccountCreated?: boolean;
    /** Initial submitting state — used in Storybook to show the sending verification code state */
    defaultSubmitting?: boolean;
}

export default function RegisterCustomerSelection({
    onSaved,
    onRegistrationSuccess,
    savePaymentToProfile: _savePaymentToProfile = false,
    showToast,
    defaultChecked = false,
    defaultAccountCreated = false,
    defaultSubmitting = false,
}: RegisterCustomerSelectionProps) {
    const [shouldCreateAccount, setShouldCreateAccount] = useState(defaultChecked || defaultSubmitting);
    const [accountCreated, setAccountCreated] = useState(defaultAccountCreated);
    const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
    const [registrationEmail, setRegistrationEmail] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const { t: _t } = useTranslation('checkout');
    const t = _t as (key: string, options?: object) => string;
    const basket = useBasket();
    const config = useConfig();
    const registrationFetcher = useFetcher<typeof initiateRegistrationAction>({ key: 'checkout-registration' });
    const lastProcessedDataRef = useRef<InitiateRegistrationResponse | null>(null);

    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const turnstileResetRef = useRef<(() => void) | null>(null);
    // The widget is always rendered when Turnstile is enabled. The server's `cc-tv`
    // httpOnly cookie is the single source of truth for "this client passed Turnstile
    // recently"; if it's present the server skips re-verification regardless of whether
    // the client also sends a token, so the cost of mounting the widget here is just an
    // extra silent siteverify roundtrip in the rare interactive-required case.
    // Mirroring the cookie via client-side state (e.g. sessionStorage) would just
    // duplicate state for no benefit — the server cookie already covers the skip path.
    const turnstileEnabled = config ? isTurnstileEnabled(config as AppConfig) : false;
    const turnstileMode = config ? getTurnstileMode(config as AppConfig) : 'managed';
    const turnstileSiteKey = useMemo(() => {
        if (!config || !turnstileEnabled) return null;
        if (typeof window !== 'undefined') {
            const baseUrl = `${window.location.protocol}//${window.location.host}`;
            return getTurnstileSiteKey(config as AppConfig, baseUrl);
        }
        return null;
    }, [config, turnstileEnabled]);

    const resetTurnstile = useCallback(() => {
        setTurnstileToken(null);
        turnstileResetRef.current?.();
    }, []);

    const handleTurnstileSuccess = useCallback((token: string) => {
        setTurnstileToken(token);
    }, []);

    const handleTurnstileError = useCallback(() => {
        setTurnstileToken(null);
    }, []);

    const handleTurnstileExpire = useCallback(() => {
        setTurnstileToken(null);
    }, []);

    const handleCheckboxChange = (checked: boolean) => {
        setShouldCreateAccount(checked);
        setError(null);

        if (checked) {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('registeredViaCheckout', 'true');
            }

            const email = basket?.customerInfo?.email;
            if (!email) {
                const errorMsg = t('registration.emailNotFound');
                setError(errorMsg);
                showToast?.(errorMsg, 'error');
                setShouldCreateAccount(false);
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem('registeredViaCheckout');
                }
                return;
            }

            setRegistrationEmail(email);

            const formData = new FormData();
            formData.append('email', email);
            if (turnstileToken) {
                formData.append('turnstileToken', turnstileToken);
            }

            void registrationFetcher.submit(formData, {
                method: 'POST',
                action: resourceRoutes.initiateCheckoutRegistration,
            });
            if (turnstileEnabled) resetTurnstile();
        } else {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('registeredViaCheckout');
            }
            onSaved?.(false);
        }
    };

    useEffect(() => {
        const { state, data } = registrationFetcher;

        if (state === 'idle' && data && data !== lastProcessedDataRef.current) {
            lastProcessedDataRef.current = data;

            if (data.success) {
                setIsOtpModalOpen(true);
            } else if (data.unavailable) {
                setShouldCreateAccount(false);
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem('registeredViaCheckout');
                }
            } else {
                const errorMsg = t('registration.initiationFailed');
                setError(errorMsg);
                showToast?.(errorMsg, 'error');
                setShouldCreateAccount(false);
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem('registeredViaCheckout');
                }
            }
        }
    }, [registrationFetcher, registrationFetcher.state, registrationFetcher.data, t, showToast]);

    const handleOtpSuccess = (tokenResponse?: ShopperLogin.schemas['TokenResponse']) => {
        setIsOtpModalOpen(false);
        setAccountCreated(true);
        onSaved?.(true);

        if (typeof sessionStorage !== 'undefined' && tokenResponse) {
            sessionStorage.setItem('checkoutRegistrationTokens', JSON.stringify(tokenResponse));
        }

        showToast?.(t('registration.accountCreatedSuccess'), 'success', { duration: 8000 });
        onRegistrationSuccess?.();
    };

    const handleOtpModalClose = () => {
        setIsOtpModalOpen(false);
        setShouldCreateAccount(false);
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('registeredViaCheckout');
        }
        onSaved?.(false);
    };

    const handleResendCode = async () => {
        const formData = new FormData();
        formData.append('email', registrationEmail);
        if (turnstileToken) {
            formData.append('turnstileToken', turnstileToken);
        }

        return new Promise<void>((resolve, _reject) => {
            void registrationFetcher.submit(formData, {
                method: 'POST',
                action: resourceRoutes.initiateCheckoutRegistration,
            });
            if (turnstileEnabled) resetTurnstile();

            setTimeout(() => resolve(), 1000);
        });
    };

    const handleCheckoutAsGuest = () => {
        setShouldCreateAccount(false);
        setIsOtpModalOpen(false);
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('registeredViaCheckout');
        }
        onSaved?.(false);
    };

    if (accountCreated) {
        return (
            <section
                className="flex items-start gap-4 border border-input p-4"
                aria-label={t('registration.accountCreatedTitle')}>
                <div className="flex flex-1 flex-col gap-1">
                    <h6 className="text-sm font-semibold text-foreground">{t('registration.accountCreatedTitle')}</h6>
                    <p className="text-sm leading-5 text-muted-foreground">
                        {t('registration.accountCreatedDescription')}
                    </p>
                </div>
                <Badge variant="success" className="rounded-none">
                    {t('registration.verified')}
                </Badge>
            </section>
        );
    }

    return (
        <div data-testid="register-customer-checkbox">
            <label
                htmlFor="create-account-checkbox"
                className="flex cursor-pointer items-start gap-2 border border-input p-4">
                <Checkbox
                    id="create-account-checkbox"
                    data-testid="create-account-checkbox"
                    checked={shouldCreateAccount}
                    onCheckedChange={(checked) => handleCheckboxChange(checked === true)}
                    className="mt-0.5 shrink-0"
                    aria-label={t('payment.saveForFutureUse')}
                    disabled={registrationFetcher.state === 'submitting' || defaultSubmitting}
                />
                <div className="flex flex-1 flex-col gap-1 text-sm">
                    <span className="font-medium leading-5 text-foreground">{t('payment.saveForFutureUse')}</span>
                    <span className="leading-5 text-foreground">{t('payment.createAccountForFasterCheckout')}</span>
                    {(registrationFetcher.state === 'submitting' || defaultSubmitting) && (
                        <p className="text-muted-foreground">{t('registration.sendingVerificationCode')}</p>
                    )}
                    {shouldCreateAccount &&
                        !error &&
                        registrationFetcher.state !== 'submitting' &&
                        !defaultSubmitting && (
                            <p className="mt-3 leading-5 text-foreground">
                                {t('registration.checkboxExpandedDescription')}
                            </p>
                        )}
                </div>
            </label>
            {turnstileEnabled && turnstileSiteKey && (
                <TurnstileWidget
                    siteKey={turnstileSiteKey}
                    onSuccess={handleTurnstileSuccess}
                    onError={handleTurnstileError}
                    onExpire={handleTurnstileExpire}
                    enabled={turnstileEnabled}
                    mode={turnstileMode}
                    resetRef={turnstileResetRef}
                />
            )}

            {isOtpModalOpen && (
                <Suspense fallback={null}>
                    <OtpModal
                        isOpen={isOtpModalOpen}
                        onClose={handleOtpModalClose}
                        email={registrationEmail}
                        onSuccess={handleOtpSuccess}
                        onCheckoutAsGuest={handleCheckoutAsGuest}
                        onResendCode={handleResendCode}
                        otpLength={(config.auth as { otpLength: number })?.otpLength ?? 6}
                        isRegistration={true}
                    />
                </Suspense>
            )}
        </div>
    );
}
