import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackingConsent } from '@/types/tracking-consent';
import NoibuProvider from '../providers/noibu-provider';

const mockUseConfig = vi.fn();
const mockUseTrackingConsent = vi.fn();
const mockAddAdapter = vi.hoisted(() => vi.fn());

vi.mock('@salesforce/storefront-next-runtime/config', () => ({
    useConfig: () => mockUseConfig(),
}));

vi.mock('@/hooks/use-tracking-consent', () => ({
    useTrackingConsent: () => mockUseTrackingConsent(),
}));

vi.mock('@/lib/adapters', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/adapters')>();
    return { ...actual, addAdapter: mockAddAdapter };
});

const CONFIG = {
    engagement: {
        analytics: {
            trackingConsent: {
                consentCategories: ['necessary', 'analytics', 'marketing', 'personalization'],
            },
        },
    },
};

function noibuScript() {
    return document.querySelector('script[src="https://cdn.noibu.com/collect-core.js"]');
}

beforeEach(() => {
    mockAddAdapter.mockReset();
    localStorage.clear();
    mockUseConfig.mockReturnValue(CONFIG);
});

// NOTE: React 19 caches hoisted <script src> per document and will not re-insert the same
// src once rendered, so the tests that assert the script is ABSENT must run before the
// first consent-granted render, and later consent-granted tests assert on addAdapter only.
describe('NoibuProvider', () => {
    it('renders children regardless of consent', () => {
        mockUseTrackingConsent.mockReturnValue({ trackingConsent: undefined, isTrackingConsentEnabled: true });
        const { getByText } = render(
            <NoibuProvider>
                <span>test content</span>
            </NoibuProvider>,
        );
        expect(getByText('test content')).toBeTruthy();
    });

    it('does not inject script or register adapter when consent is declined', () => {
        mockUseTrackingConsent.mockReturnValue({
            trackingConsent: TrackingConsent.Declined,
            isTrackingConsentEnabled: true,
        });
        render(
            <NoibuProvider>
                <span />
            </NoibuProvider>,
        );
        expect(noibuScript()).toBeNull();
        expect(mockAddAdapter).not.toHaveBeenCalled();
        expect(localStorage.getItem('n_platform')).toBeNull();
    });

    it('does not inject script or register adapter while consent is undetermined', () => {
        mockUseTrackingConsent.mockReturnValue({ trackingConsent: undefined, isTrackingConsentEnabled: true });
        render(
            <NoibuProvider>
                <span />
            </NoibuProvider>,
        );
        expect(noibuScript()).toBeNull();
        expect(mockAddAdapter).not.toHaveBeenCalled();
    });

    it('does not inject script or register adapter when localStorage is unavailable', () => {
        mockUseTrackingConsent.mockReturnValue({
            trackingConsent: TrackingConsent.Accepted,
            isTrackingConsentEnabled: true,
        });
        const originalStorage = window.localStorage;
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                setItem: () => {
                    throw new Error('QuotaExceededError');
                },
            },
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            render(
                <NoibuProvider>
                    <span />
                </NoibuProvider>,
            );
            expect(noibuScript()).toBeNull();
            expect(mockAddAdapter).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('localStorage is unavailable'));
        } finally {
            Object.defineProperty(window, 'localStorage', { configurable: true, value: originalStorage });
            warnSpy.mockRestore();
        }
    });

    it('injects script and registers adapter when consent is accepted', () => {
        mockUseTrackingConsent.mockReturnValue({
            trackingConsent: TrackingConsent.Accepted,
            isTrackingConsentEnabled: true,
        });
        render(
            <NoibuProvider>
                <span />
            </NoibuProvider>,
        );
        // React 19 hoists <script src> to <head> — query document, not container
        const script = noibuScript();
        expect(script).toBeTruthy();
        expect(script?.hasAttribute('async')).toBe(true);
        expect(mockAddAdapter).toHaveBeenCalledWith('noibu', expect.objectContaining({ name: 'noibu' }));
        expect(localStorage.getItem('n_platform')).toBe('1');
    });

    it('registers adapter when the consent system is disabled and categories include analytics', () => {
        mockUseTrackingConsent.mockReturnValue({ trackingConsent: undefined, isTrackingConsentEnabled: false });
        render(
            <NoibuProvider>
                <span />
            </NoibuProvider>,
        );
        expect(mockAddAdapter).toHaveBeenCalled();
        expect(localStorage.getItem('n_platform')).toBe('1');
    });
});
