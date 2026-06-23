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
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { useScapiFetchClient } from '@/hooks/use-scapi-fetch';
import type { ApiResponse } from '@/lib/scapi/types';
import { EMPTY_WISHLIST_STATE, type WishlistInitialState } from '@/lib/wishlist/state';

/**
 * Placeholder itemId stored alongside an optimistically-inserted product while the
 * SCAPI add call is in flight. The real itemId returned by SCAPI replaces this on
 * success; on failure the entry is removed entirely. Exported only for tests.
 */
const PENDING_ITEM_ID = '__pending__';

export type WishlistEntry = { itemId: string };

/**
 * Referentially-stable external store for the `productId → { itemId }` map.
 * Inspired by `createSubCategoryStore` in `navigation-menu/context.ts`.
 *
 * Subscribers are only invoked when the underlying map identity changes, and
 * per-id consumers (via `useIsInWishlist`) only re-render when *their* entry
 * changes identity — so a heart icon for product A never re-renders when
 * product B is added or removed.
 */
export type WishlistStore = ReturnType<typeof createWishlistStore>;

function createWishlistStore(initial: ReadonlyMap<string, WishlistEntry>) {
    let data: ReadonlyMap<string, WishlistEntry> = new Map(initial);
    const listeners = new Set<() => void>();

    const notify = () => {
        listeners.forEach((l) => l());
    };

    return {
        subscribe(this: void, listener: () => void): () => void {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot(this: void): ReadonlyMap<string, WishlistEntry> {
            return data;
        },
        get(this: void, productId: string): WishlistEntry | undefined {
            return data.get(productId);
        },
        has(this: void, productId: string): boolean {
            return data.has(productId);
        },
        size(this: void): number {
            return data.size;
        },
        /** Insert/replace a single entry. Notifies on identity change of the entry. */
        set(this: void, productId: string, entry: WishlistEntry): void {
            const prev = data.get(productId);
            if (prev && prev.itemId === entry.itemId) {
                // Identical entry; skip notify so per-id subscribers don't re-render.
                return;
            }
            const next = new Map(data);
            next.set(productId, entry);
            data = next;
            notify();
        },
        /** Remove a single entry. No-op if absent. */
        delete(this: void, productId: string): void {
            if (!data.has(productId)) return;
            const next = new Map(data);
            next.delete(productId);
            data = next;
            notify();
        },
        /** Bulk replace. Used when async hydration of initialState resolves. */
        replaceAll(this: void, entries: ReadonlyMap<string, WishlistEntry>): void {
            data = new Map(entries);
            notify();
        },
    };
}

/**
 * Actions exposed to mutating components. The reference identity of `add`,
 * `remove`, and `toggle` only changes when the underlying SCAPI client identity
 * changes (i.e. `customerId`/`listId` change). `isPending` is a global "any
 * mutation in flight" flag — components that need per-product pending state
 * should derive it from the `__pending__` sentinel via `useWishlistEntry`.
 */
export type WishlistActions = {
    /** Optimistic add. Resolves with the SCAPI result; rolls back on `!success`. */
    add: (productId: string) => Promise<ApiResponse<unknown>>;
    /** Optimistic remove. */
    remove: (productId: string) => Promise<ApiResponse<unknown>>;
    /** Convenience: add when absent, remove when present. */
    toggle: (productId: string) => Promise<ApiResponse<unknown>>;
    /** True while any add/remove is in flight. */
    isPending: boolean;
};

const WishlistStoreContext = createContext<WishlistStore | null>(null);
const WishlistActionsContext = createContext<WishlistActions | null>(null);

/**
 * Internal helper — looks up the store from context and throws if used outside
 * `<WishlistProvider>` so missing providers surface as clear dev-time errors
 * rather than silent empty UI in production.
 */
function useWishlistStore(): WishlistStore {
    const store = useContext(WishlistStoreContext);
    if (!store) {
        throw new Error('Wishlist hooks must be used inside <WishlistProvider>');
    }
    return store;
}

/**
 * Subscribe to whether a specific `productId` is currently in the wishlist.
 *
 * Re-renders ONLY when the entry for that productId is added, removed, or its
 * itemId changes (e.g. placeholder → real id on add success). A change to a
 * different product's entry will not trigger a re-render here. Use this for
 * per-tile heart icons in product grids.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useIsInWishlist(productId: string | undefined): boolean {
    const store = useWishlistStore();
    const subscribe = store.subscribe;
    const getEntry = useCallback(
        () => (productId ? store.getSnapshot().get(productId) : undefined),
        [store, productId]
    );
    const entry = useSyncExternalStore(subscribe, getEntry, getEntry);
    return entry !== undefined;
}

/**
 * Subscribe to the per-product wishlist entry, including its pending state.
 *
 * Returns `{ inWishlist, pending }` where `pending` is true while the
 * optimistic add for that specific product is awaiting SCAPI confirmation
 * (placeholder itemId). Re-renders only when the entry identity changes.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWishlistEntry(productId: string | undefined): {
    inWishlist: boolean;
    pending: boolean;
} {
    const store = useWishlistStore();
    const subscribe = store.subscribe;
    const getEntry = useCallback(
        () => (productId ? store.getSnapshot().get(productId) : undefined),
        [store, productId]
    );
    const entry = useSyncExternalStore(subscribe, getEntry, getEntry);
    return useMemo(
        () => ({
            inWishlist: entry !== undefined,
            pending: entry?.itemId === PENDING_ITEM_ID,
        }),
        [entry]
    );
}

/**
 * Subscribe to the wishlist size. Re-renders only when the count changes — adds
 * and removes both flip identity, but optimistic placeholder → real-id swaps
 * do not change the count and so do not re-render badge consumers.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWishlistCount(): number {
    const store = useWishlistStore();
    const subscribe = store.subscribe;
    const getSize = useCallback(() => store.getSnapshot().size, [store]);
    return useSyncExternalStore(subscribe, getSize, getSize);
}

/**
 * Subscribe to the full set of product IDs in the wishlist.
 *
 * Returns a referentially-stable `ReadonlySet<string>` that only changes
 * identity when membership changes. Use sparingly — most consumers should
 * prefer {@link useIsInWishlist} or {@link useWishlistCount} which avoid
 * re-rendering on unrelated mutations.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWishlistIds(): ReadonlySet<string> {
    const store = useWishlistStore();
    const subscribe = store.subscribe;
    // Memoize the derived Set per snapshot identity so getSnapshot returns a
    // stable reference between unrelated subscribes (required by useSyncExternalStore).
    const cacheRef = useRef<{ map: ReadonlyMap<string, WishlistEntry>; ids: ReadonlySet<string> } | null>(null);
    const getIds = useCallback(() => {
        const map = store.getSnapshot();
        if (cacheRef.current && cacheRef.current.map === map) {
            return cacheRef.current.ids;
        }
        const ids: ReadonlySet<string> = new Set(map.keys());
        cacheRef.current = { map, ids };
        return ids;
    }, [store]);
    return useSyncExternalStore(subscribe, getIds, getIds);
}

/**
 * Read the wishlist mutation actions and the global pending flag.
 *
 * Components that need to mutate (heart buttons, "remove" links) should use
 * this hook for `add`/`remove`/`toggle`. To display per-product visual state
 * (filled heart, in-flight spinner), pair with {@link useIsInWishlist} or
 * {@link useWishlistEntry} — those subscribe with topic granularity and avoid
 * re-rendering on every global pending flip.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWishlistActions(): WishlistActions {
    const ctx = useContext(WishlistActionsContext);
    if (!ctx) {
        throw new Error('useWishlistActions must be used inside <WishlistProvider>');
    }
    return ctx;
}

/**
 * Route-local wishlist provider. Mount once per route that renders wishlist UI
 * (PLP, PDP, search, cart, home recommenders, account overview); routes without
 * wishlist UI shouldn't mount it and pay no SCAPI hydration cost.
 *
 * Holds the `productId → itemId` mapping required for SCAPI deletes in a
 * referentially-stable external store; consumers subscribe with topic
 * granularity via {@link useIsInWishlist}, {@link useWishlistCount}, etc.
 *
 * `add`/`remove` flip optimistic state synchronously, then issue the SCAPI call
 * via `useScapiFetchClient` and roll back on failure. On `add` success the
 * placeholder itemId is replaced with the real value returned by SCAPI.
 */
export function WishlistProvider({
    initialState,
    children,
}: {
    /**
     * Wishlist initial state. Pass a `Promise` from a route loader to defer the
     * SCAPI hydration off the SSR critical path — the provider mounts immediately
     * with empty state, then hydrates the store + customer/list IDs in a
     * `useEffect` once the Promise resolves. Pass a sync value when the loader
     * already awaited it (e.g. tests, or a route that doesn't mind blocking).
     *
     * Hearts render unfilled until hydration completes — uncritical for product
     * tiles (the `<DeferredWishlistButton>` placeholder is gated on hover anyway)
     * and acceptable for eagerly-mounted hearts (the SCAPI round-trip is fast
     * enough that the flash is rarely user-visible).
     */
    initialState: Promise<WishlistInitialState> | WishlistInitialState;
    children: ReactNode;
}) {
    // Hydrated state. Starts empty when initialState is a Promise; useEffect
    // below resolves and writes through to the store + customer/list IDs.
    const [hydrated, setHydrated] = useState<WishlistInitialState>(() =>
        initialState instanceof Promise ? EMPTY_WISHLIST_STATE : initialState
    );
    const { customerId, listId } = hydrated;

    // Single store instance per provider mount. Initial entries from the sync
    // path; for the Promise path we replaceAll() once the Promise resolves so
    // the store reference itself stays stable for the provider's lifetime.
    const [store] = useState(() =>
        createWishlistStore(initialState instanceof Promise ? new Map() : initialState.itemsByProductId)
    );

    // When initialState is a Promise, hydrate post-mount. `useEffect` doesn't run
    // on the server, so the SSR pass renders with the empty state — the wishlist
    // SCAPI call doesn't block the loader response. The promise the route passed
    // is already in flight (loader started it); we just await its resolution here.
    useEffect(() => {
        if (!(initialState instanceof Promise)) return;
        let cancelled = false;
        void initialState.then(
            (state) => {
                if (cancelled) return;
                setHydrated(state);
                store.replaceAll(state.itemsByProductId);
            },
            () => {
                // SCAPI failed; keep the empty state so hearts stay unfilled rather than crash.
            }
        );
        return () => {
            cancelled = true;
        };
    }, [initialState, store]);

    // Construction-time SCAPI hooks. customerId/listId may be null for guests; the
    // provider short-circuits add/remove before submit() is called in that case, so
    // the empty-string placeholders here are safe.
    //
    // SSR-safe: the SCAPI hooks below only memoize a URL and build a `submit`
    // callback during render — they do not fire `fetch()` or touch global state.
    // The first network call happens inside `submit`, which only runs on user
    // interaction (heart click). Initial state is hydrated from `initialState`.
    const addFetch = useScapiFetchClient('shopperCustomers', 'createCustomerProductListItem', {
        params: { path: { customerId: customerId ?? '', listId: listId ?? '' } },
        // Construction-time placeholder; the real body is supplied per-call to submit().
        // SCAPI requires priority/quantity/public on this endpoint.
        body: { productId: '', quantity: 1, type: 'product', public: false, priority: 1 },
    });
    const removeFetch = useScapiFetchClient('shopperCustomers', 'deleteCustomerProductListItem', {
        params: { path: { customerId: customerId ?? '', listId: listId ?? '', itemId: '__placeholder__' } },
    });

    const isPending = addFetch.isPending || removeFetch.isPending;

    // Stash the latest SCAPI submit functions on a ref so the action callbacks
    // below stay referentially stable across re-renders (they only need to read
    // the *current* submit, not capture it).
    const addSubmitRef = useRef(addFetch.submit);
    addSubmitRef.current = addFetch.submit;
    const removeSubmitRef = useRef(removeFetch.submit);
    removeSubmitRef.current = removeFetch.submit;

    const add = useCallback(
        async (productId: string): Promise<ApiResponse<unknown>> => {
            if (!customerId || !listId) {
                return { success: false, errors: ['Not signed in'] };
            }

            // Fast path: item is confirmed in the server-side wishlist already.
            // Surface as a typed signal so the caller can show the right toast
            // ("already in wishlist") instead of triggering a duplicate SCAPI call.
            const existing = store.get(productId);
            if (existing && existing.itemId !== PENDING_ITEM_ID) {
                return { success: true, data: { alreadyInWishlist: true } };
            }
            // An add for the same product is in flight from another button — refuse rather
            // than show a misleading "already in wishlist" toast for an unconfirmed insert.
            if (existing?.itemId === PENDING_ITEM_ID) {
                return { success: false, errors: ['Wishlist update in progress'] };
            }

            // Optimistic insert with placeholder itemId; replaced on success.
            store.set(productId, { itemId: PENDING_ITEM_ID });

            const result = await addSubmitRef.current({
                productId,
                quantity: 1,
                type: 'product',
                public: false,
                priority: 1,
            });

            if (!result.success) {
                store.delete(productId);
                return result;
            }

            const realItemId = (result.data as { id?: string } | undefined)?.id;
            if (realItemId) {
                store.set(productId, { itemId: realItemId });
                return result;
            }
            // Defensive: SCAPI returned success without an item id. Roll back the optimistic
            // insert and convert the result to a failure so the caller can surface an error
            // instead of leaving a `__pending__` placeholder that no future remove() can clear.
            store.delete(productId);
            return { success: false, errors: ['Wishlist item missing id'] };
        },
        [customerId, listId, store]
    );

    const remove = useCallback(
        async (productId: string): Promise<ApiResponse<unknown>> => {
            if (!customerId || !listId) {
                return { success: false, errors: ['Not signed in'] };
            }
            const item = store.get(productId);
            if (!item) {
                return { success: false, errors: ['Not in wishlist'] };
            }
            // The optimistic add for this product hasn't confirmed yet — we don't have a
            // real itemId to send to SCAPI. Refuse rather than fire a guaranteed-4xx delete
            // with the placeholder string.
            if (item.itemId === PENDING_ITEM_ID) {
                return { success: false, errors: ['Wishlist update in progress'] };
            }

            // Optimistic delete.
            store.delete(productId);

            // Per-call params override re-encodes the URL with the real itemId for this submit.
            const result = await removeSubmitRef.current(undefined, {
                params: { path: { customerId, listId, itemId: item.itemId } },
            });

            if (!result.success) {
                // Rollback to the prior entry (preserves itemId for any retry).
                store.set(productId, item);
            }
            return result;
        },
        [customerId, listId, store]
    );

    const toggle = useCallback(
        (productId: string) => (store.has(productId) ? remove(productId) : add(productId)),
        [store, add, remove]
    );

    const actions = useMemo<WishlistActions>(
        () => ({ add, remove, toggle, isPending }),
        [add, remove, toggle, isPending]
    );

    return (
        <WishlistStoreContext.Provider value={store}>
            <WishlistActionsContext.Provider value={actions}>{children}</WishlistActionsContext.Provider>
        </WishlistStoreContext.Provider>
    );
}
