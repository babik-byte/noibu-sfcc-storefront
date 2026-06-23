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
import { useState, useMemo } from 'react';
import { useRouteLoaderData } from 'react-router';
import { useTrackingConsent } from '@/hooks/use-tracking-consent';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UITarget } from '@/targets/ui-target';
import { useTranslation } from 'react-i18next';
import { TrackingConsent } from '@/types/tracking-consent';

type ProcessingAction = 'accept' | 'decline' | 'close' | null;

export interface TrackingConsentBannerProps {
    /**
     * Optional callback function called after user responds to consent banner.
     * Called after SLAS token is refreshed to ensure hybrid compatibility.
     * Can return a Promise for async operations.
     *
     * @param consent - TrackingConsent enum value (Accepted or Declined)
     *
     * @example
     * <TrackingConsentBanner
     *   onConsentChange={(consent) => {
     *     if (window.customAnalytics) {
     *       window.customAnalytics.setTrackingEnabled(consent === TrackingConsent.Accepted);
     *     }
     *   }}
     * />
     *
     * @example
     * // Async callback
     * <TrackingConsentBanner
     *   onConsentChange={async (consent) => {
     *     await sendConsentToServer(consent);
     *   }}
     * />
     */
    onConsentChange?: (consent: TrackingConsent) => void | Promise<void>;
}

/**
 * Tracking Consent Banner Component
 *
 * Displays a non-intrusive banner at the bottom of the page to collect user consent
 * for tracking. The banner:
 * - Only shows if tracking consent is enabled in config and user hasn't responded
 * - Refreshes SLAS token with tracking consent value (server sets dw_dnt cookie via Set-Cookie header)
 * - Supports custom onConsentChange callback for external analytics integration
 *
 * @example
 * // Basic usage (default behavior)
 * <TrackingConsentBanner />
 *
 * @example
 * // With custom analytics integration
 * <TrackingConsentBanner
 *   onConsentChange={(consent) => {
 *     configureExternalAnalytics(consent === TrackingConsent.Accepted);
 *   }}
 * />
 */
export function TrackingConsentBanner({ onConsentChange }: TrackingConsentBannerProps) {
    const { shouldShowBanner, setTrackingConsent, defaultTrackingConsent, isTrackingConsentEnabled } =
        useTrackingConsent();
    const [processingAction, setProcessingAction] = useState<ProcessingAction>(null);
    const config = useConfig();
    const { t } = useTranslation('trackingConsent');

    const trackingConsentConfig = useMemo(
        () => config.engagement?.analytics?.trackingConsent,
        [config.engagement?.analytics?.trackingConsent]
    );

    const isProcessing = processingAction !== null;

    const handleConsent = async (consent: TrackingConsent, action: ProcessingAction) => {
        if (isProcessing || !isTrackingConsentEnabled) return;

        setProcessingAction(action);

        try {
            await setTrackingConsent(consent);

            if (onConsentChange) {
                await onConsentChange(consent);
            }
            // eslint-disable-next-line no-empty
        } catch {
        } finally {
            setProcessingAction(null);
        }
    };

    const handleClose = () => {
        void handleConsent(defaultTrackingConsent, 'close');
    };

    const handleAccept = () => {
        void handleConsent(TrackingConsent.Accepted, 'accept');
    };

    const handleDecline = () => {
        void handleConsent(TrackingConsent.Declined, 'decline');
    };

    const rootData = useRouteLoaderData('root');

    if (!shouldShowBanner || rootData?.pageDesignerMode) {
        return null;
    }

    const position = trackingConsentConfig?.position ?? 'bottom-center';

    const positionClasses = {
        'bottom-left': 'left-0 md:left-4 bottom-0 md:bottom-4',
        'bottom-right': 'right-0 md:right-4 bottom-0 md:bottom-4',
        'bottom-center': 'left-0 md:left-1/2 md:-translate-x-1/2 bottom-0 md:bottom-4',
    };

    return (
        <UITarget targetId="sfcc.global.cookies.banner">
            <div
                className={cn(
                    'fixed z-50 w-full md:max-w-md animate-in slide-in-from-bottom-5 duration-300',
                    positionClasses[position] || positionClasses['bottom-center']
                )}
                role="dialog"
                aria-labelledby="tracking-consent-banner-title"
                aria-describedby="tracking-consent-banner-description">
                <Card className="relative shadow-lg">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4 h-8 w-8 shrink-0 opacity-70 transition-opacity hover:opacity-100"
                        onClick={handleClose}
                        disabled={isProcessing}
                        aria-label={t('closeAriaLabel')}>
                        {processingAction === 'close' ? <Spinner size="sm" /> : <XIcon className="size-4" />}
                        <span className="sr-only">{t('closeAriaLabel')}</span>
                    </Button>
                    <CardContent className="pt-6 pr-10">
                        <div className="space-y-2">
                            <h2 id="tracking-consent-banner-title" className="text-sm font-semibold">
                                {t('title')}
                            </h2>
                            <p id="tracking-consent-banner-description" className="text-sm text-muted-foreground">
                                {t('description')}
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex gap-2 pt-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDecline}
                            disabled={isProcessing}
                            className="flex-1">
                            {processingAction === 'decline' && <Spinner size="sm" />}
                            {t('decline')}
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleAccept}
                            disabled={isProcessing}
                            className="flex-1">
                            {processingAction === 'accept' && <Spinner size="sm" />}
                            {t('accept')}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </UITarget>
    );
}
