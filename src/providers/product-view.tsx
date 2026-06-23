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

import { createContext, useContext, type PropsWithChildren } from 'react';
import type { ShopperProducts } from '@/scapi';
import { useProductActions } from '@/hooks/product/use-product-actions';
import { useCurrentVariant } from '@/hooks/product/use-current-variant';

interface ProductViewContextValue extends ReturnType<typeof useProductActions> {
    product: ShopperProducts.schemas['Product'];
    mode: 'add' | 'edit';
}

const ProductViewContext = createContext<ProductViewContextValue | null>(null);

interface ProductViewProviderProps {
    product: ShopperProducts.schemas['Product'];
    mode?: 'add' | 'edit';
    initialQuantity?: number;
    maxQuantity?: number;
    itemId?: string;
    /** Optional: Pass a currentVariant directly (e.g., from controlled modal state) instead of deriving from URL */
    currentVariant?: ShopperProducts.schemas['Variant'];
}

/**
 * Provider for product view state that manages shared product data, quantity, and actions.
 *
 * This provider helps avoid prop drilling by sharing state like quantity, inventory status,
 * and action handlers (add to cart, add to wishlist) across product view children components.
 *
 * **Usage:**
 * - Wrap product view components (ProductInfo, ProductActions) with this provider
 * - Use `useProductView` hook in child components to access shared state
 * - Set `mode="edit"` for edit mode (e.g cart edit also needs to show product view),
 *      `mode="add"` (default) for product display pages
 *
 * @example
 * ```tsx
 * <ProductViewProvider product={product} mode="edit" initialQuantity={4}>
 *   <ProductInfo />
 *   <ProductCartActions />
 * </ProductViewProvider>
 * ```
 */
const ProductViewProvider = ({
    children,
    product,
    mode = 'add',
    initialQuantity,
    maxQuantity,
    itemId,
    currentVariant: providedCurrentVariant,
}: PropsWithChildren<ProductViewProviderProps>) => {
    // Use provided variant if available (e.g., from controlled modal state),
    // otherwise derive from URL for PDP use case
    const urlBasedCurrentVariant = useCurrentVariant({ product });
    const currentVariant = providedCurrentVariant || urlBasedCurrentVariant;

    const productActionsData = useProductActions({
        product,
        currentVariant,
        initialQuantity,
        maxQuantity,
        itemId,
    });

    return (
        <ProductViewContext.Provider value={{ product, mode, ...productActionsData }}>
            {children}
        </ProductViewContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useProductView = () => {
    const context = useContext(ProductViewContext);
    if (!context) {
        throw new Error('useProductView must be used within ProductViewProvider');
    }
    return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useOptionalProductView = () => useContext(ProductViewContext);

export default ProductViewProvider;
