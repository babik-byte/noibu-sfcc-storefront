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
import { createContext, type PropsWithChildren, useCallback, useContext, useSyncExternalStore } from 'react';
import type { NavigateFunction } from 'react-router';
import { useNavigate } from '@/hooks/use-navigate';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import defaultTheme from 'tailwindcss/defaultTheme';
import type { ShopperSearch } from '@/scapi';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import type { AppConfig, BadgeDetail } from '@/types/config';
import { useSite } from '@salesforce/storefront-next-runtime/site-context';
import { getProductBadges } from '@/lib/product/product-badges';

type ProductBadgesResult = { badges: BadgeDetail[]; hasBadges: boolean };

interface ProductTileContextValue {
    navigate: NavigateFunction;
    config: AppConfig;
    t: TFunction<'product'>;
    currency?: string;
    swatchMode: 'click' | 'hover';
    getBadges: (product: ShopperSearch.schemas['ProductSearchHit']) => ProductBadgesResult;
}

const ProductTileContext = createContext<ProductTileContextValue | null>(null);

const DESKTOP_QUERY = `(min-width: ${defaultTheme.screens.lg})`;

/**
 * Subscribes to viewport changes against tailwind's `lg` breakpoint (desktop device).
 * Returns an unsubscribe function.
 */
function subscribeToDesktopQuery(callback: () => void) {
    const mql = globalThis.matchMedia?.(DESKTOP_QUERY);
    mql?.addEventListener('change', callback);
    return () => mql?.removeEventListener('change', callback);
}

/**
 * Client snapshot: returns `'hover'` on desktop viewports, `'click'` on mobile.
 */
function getSwatchModeSnapshot(): 'click' | 'hover' {
    return globalThis.matchMedia?.(DESKTOP_QUERY)?.matches ? 'hover' : 'click';
}

/**
 * Server snapshot: always returns `'click'` since `matchMedia` is unavailable during SSR.
 */
function getSwatchModeServerSnapshot(): 'click' | 'hover' {
    return 'click';
}

/**
 * Determines swatch interaction mode (`'hover'` on desktop, `'click'` on mobile) via a single shared `matchMedia`
 * subscription. Hydration-safe through the server snapshot.
 */
function useSwatchMode(): 'click' | 'hover' {
    return useSyncExternalStore(subscribeToDesktopQuery, getSwatchModeSnapshot, getSwatchModeServerSnapshot);
}

/**
 * Provider that initializes shared hooks once for all product tiles, e.g., displayed in a product grid.
 * This reduces hydration overhead by avoiding repeated hook initialization for each tile,
 * (e.g., 24 tiles = 96x hook calls reduced to 24x context hook calls + the hooks in the provider).
 * Additionally, this provider optimizes the `swatchMode` determination by using `useSyncExternalStore` to
 * achieve a single `matchMedia` subscription instead of one per tile. That's hydration-safe due to server snapshot
 * and synchronous updates used on viewport changes.
 */
export function ProductTileProvider({ children }: PropsWithChildren) {
    const navigate = useNavigate();
    const config = useConfig();
    const { t } = useTranslation('product');
    const { currency } = useSite();
    const swatchMode = useSwatchMode();
    const getBadges = useCallback(
        (product: ShopperSearch.schemas['ProductSearchHit']) =>
            getProductBadges({ product, badgeDetails: config.global.badges, maxBadges: 2 }),
        [config.global.badges]
    );

    return (
        <ProductTileContext.Provider value={{ navigate, config, t, currency, swatchMode, getBadges }}>
            {children}
        </ProductTileContext.Provider>
    );
}

/**
 * Hook that returns context if available, otherwise falls back to direct hook calls.
 * This allows ProductTile to work both inside and outside of ProductTileProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useProductTileContext(): ProductTileContextValue {
    const context = useContext(ProductTileContext);
    if (context) {
        return context;
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const config = useConfig();

    return {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        navigate: useNavigate(),
        config,
        // eslint-disable-next-line react-hooks/rules-of-hooks
        t: useTranslation('product').t,
        // eslint-disable-next-line react-hooks/rules-of-hooks
        currency: useSite().currency,
        // eslint-disable-next-line react-hooks/rules-of-hooks
        swatchMode: useSwatchMode(),
        getBadges: (product: ShopperSearch.schemas['ProductSearchHit']) =>
            getProductBadges({ product, badgeDetails: config.global.badges, maxBadges: 2 }),
    };
}
