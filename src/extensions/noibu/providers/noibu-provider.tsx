import { useEffect, type ReactNode, type ReactElement } from 'react';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import { addAdapter, buildConsentPreferences, hasConsent } from '@/lib/adapters';
import { useTrackingConsent } from '@/hooks/use-tracking-consent';
import { createLogger } from '@/lib/logger';
import { createNoibuAdapter, NOIBU_ADAPTER_NAME } from '../adapters/noibu-adapter';

export const NOIBU_CONSENT_CATEGORY = 'analytics';

const logger = createLogger();

let storageWarningLogged = false;

/**
 * Writes the flag telling the Noibu SDK that ecommerce events come from this
 * adapter. The write doubles as the storage availability probe: localStorage
 * throws in Safari private mode / when storage is blocked, and NoibuJS cannot
 * function without it, so a failed write disables the whole integration.
 */
function writeNoibuPlatformFlag(): boolean {
    try {
        localStorage.setItem('n_platform', '1');
        return true;
    } catch {
        if (!storageWarningLogged) {
            storageWarningLogged = true;
            logger.warn('Noibu disabled: localStorage is unavailable (private browsing or storage blocked)');
        }
        return false;
    }
}

export interface NoibuProviderProps {
    children: ReactNode;
}

/**
 * Injects the Noibu script and registers the Noibu engagement adapter, only
 * once the shopper has granted the 'analytics' consent category and
 * localStorage is confirmed available. Until then no Noibu code is loaded on
 * the page at all.
 * React 19 hoists the <script src> to <head> and deduplicates by src.
 * MUST be default export for extension system dynamic imports.
 */
export default function NoibuProvider({ children }: NoibuProviderProps): ReactElement {
    const config = useConfig();
    const { trackingConsent, isTrackingConsentEnabled } = useTrackingConsent();

    const consentCategories = config.engagement?.analytics?.trackingConsent?.consentCategories ?? [];
    const consentPreferences = buildConsentPreferences(trackingConsent, consentCategories, isTrackingConsentEnabled);
    const consentGranted = hasConsent(NOIBU_CONSENT_CATEGORY, consentPreferences);

    // SSR: localStorage doesn't exist on the server, so the server render assumes it is
    // available (emitting the script for consented shoppers) and the client render runs
    // the real probe. Probe order also guarantees storage is never touched pre-consent.
    const noibuEnabled = consentGranted && (typeof window === 'undefined' || writeNoibuPlatformFlag());

    useEffect(() => {
        if (!noibuEnabled) return;
        addAdapter(NOIBU_ADAPTER_NAME, createNoibuAdapter({}));
    }, [noibuEnabled]);

    return (
        <>
            {noibuEnabled && <script async src="https://cdn.noibu.com/collect-core.js" />}
            {children}
        </>
    );
}
