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
import { Outlet } from 'react-router';
import type { Route } from './+types/_app';
import { getConfig } from '@salesforce/storefront-next-runtime/config';
import { type ShopperProducts } from '@/scapi';
import { fetchCategory } from '@/lib/api/categories.server';
import { getLogger } from '@/lib/logger.server';
import Header from '@/components/header';
import Footer from '@/components/footer';
import ResponsiveNavigationMenu from '@/components/navigation-menu-mega';
import { WishlistMergeToast } from '@/components/wishlist/wishlist-merge-toast';

type LoaderData = {
    root: Promise<ShopperProducts.schemas['Category']>;
    subs: Promise<ShopperProducts.schemas['Category'][]>;
};

/**
 * We're using the `shouldRevalidate` functionality to only load the navigation menu categories from the server on the
 * very first navigation to a page using the (default) `_app` layout. Those categories requests are divided into two
 * discrete request phases; the first to only fetch the root categories, and subsequent multiple calls to fetch the
 * identified sub categories to be displayed in the navigation menu. This behavior ensures that the initial data
 * doesn't get overwritten/removed on subsequent client-side navigations.
 *
 * **Note:** If there is a desire/intent to customize that behavior, the `shouldRevalidate` function can be modified
 * accordingly. For example, a client-side storage for the categories could be introduced to implement any desired
 * caching strategy, including specific reload/refresh intervals/conditions.
 * @see {@link https://reactrouter.com/start/framework/route-module#shouldrevalidate}
 */
export function shouldRevalidate() {
    return false;
}

export function loader({ context }: Route.LoaderArgs): LoaderData {
    const logger = getLogger(context);
    const config = getConfig(context);
    const { rootCategoryId, maxDepth } = config.pages.navigation;

    logger.debug('AppLayout: loader starting', { rootCategoryId, maxDepth });

    // Load the root category and its sub categories information
    // Depth 1 fetches the root category with its immediate children
    const rootCategoryPromise = fetchCategory(context, rootCategoryId, 1);

    // Load each second-level sub categories tree as well, in case the resolved root-level category has any sub
    // categories and maxDepth allows for it. We then base this composed second-level promise on the initial root
    // category promise to allow for parallel loading and streaming of the two main promises.
    const subCategoriesPromise =
        maxDepth >= 2
            ? rootCategoryPromise.then((rootCategory: ShopperProducts.schemas['Category']) =>
                  Promise.all(
                      rootCategory.categories?.reduce(
                          (
                              acc: Promise<ShopperProducts.schemas['Category']>[],
                              subCategory: ShopperProducts.schemas['Category']
                          ) => {
                              if (
                                  typeof subCategory.onlineSubCategoriesCount === 'number' &&
                                  subCategory.onlineSubCategoriesCount > 0
                              ) {
                                  acc.push(fetchCategory(context, subCategory.id, maxDepth as 0 | 1 | 2));
                              }
                              return acc;
                          },
                          []
                      ) ?? []
                  )
              )
            : Promise.resolve([]);

    return {
        root: rootCategoryPromise,
        subs: subCategoriesPromise,
    };
}

/**
 * Default Layout Route
 *
 * This pathless layout route provides the standard storefront UI structure:
 * - Header with navigation
 * - Main content area (via `<Outlet/>`)
 * - Footer
 *
 * Routes that need this layout should be prefixed with `_app.` in their filename.
 * For routes without default header/footer (e.g., login), use the `_empty.` prefix instead.
 */
export default function DefaultLayout({ loaderData: { root, subs } }: { loaderData: LoaderData }) {
    const refRoot = useRef<Promise<ShopperProducts.schemas['Category']> | undefined>(undefined);
    const refSubs = useRef<Promise<ShopperProducts.schemas['Category'][]> | undefined>(undefined);
    if (!refRoot.current && !refSubs.current) {
        refRoot.current = root;
        refSubs.current = subs;
    }

    // <WishlistMergeToast> stays at the app shell — it reads URL params and a one-time
    // cookie set by the post-login redirect target, not wishlist state. Routes that need
    // wishlist hooks mount their own <DeferredWishlistProvider> so the SCAPI call only
    // fires on pages that actually render wishlist UI.
    return (
        <>
            <WishlistMergeToast />
            <Header>
                <ResponsiveNavigationMenu resolve={refRoot.current} defer={refSubs.current} />
            </Header>
            <main className="grow pt-8">
                <Outlet />
            </main>
            <Footer />
        </>
    );
}
