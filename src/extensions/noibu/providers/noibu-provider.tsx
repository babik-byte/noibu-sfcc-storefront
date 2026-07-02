import { useEffect, type ReactNode, type ReactElement } from 'react';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import { addAdapter, buildConsentPreferences, hasConsent } from '@/lib/adapters';
import { useTrackingConsent } from '@/hooks/use-tracking-consent';
import { createNoibuAdapter, NOIBU_ADAPTER_NAME } from '../adapters/noibu-adapter';

export const NOIBU_CONSENT_CATEGORY = 'analytics';

export interface NoibuProviderProps {
    children: ReactNode;
}

/**
 * Injects the Noibu script and registers the Noibu engagement adapter,
 * only once the shopper has granted the 'analytics' consent category.
 * Until then no Noibu code is loaded on the page at all.
 * React 19 hoists the <script src> to <head> and deduplicates by src.
 * MUST be default export for extension system dynamic imports.
 */
export default function NoibuProvider({ children }: NoibuProviderProps): ReactElement {
    const config = useConfig();
    const { trackingConsent, isTrackingConsentEnabled } = useTrackingConsent();

    const consentCategories = config.engagement?.analytics?.trackingConsent?.consentCategories ?? [];
    const consentPreferences = buildConsentPreferences(trackingConsent, consentCategories, isTrackingConsentEnabled);
    const consentGranted = hasConsent(NOIBU_CONSENT_CATEGORY, consentPreferences);

    useEffect(() => {
        if (!consentGranted) return;
        localStorage.setItem('n_platform', '1');
        addAdapter(NOIBU_ADAPTER_NAME, createNoibuAdapter({}));
    }, [consentGranted]);

    return (
        <>
            {consentGranted && <script async src="https://cdn.noibu.com/collect-core.js" />}
            {children}
        </>
    );
}
