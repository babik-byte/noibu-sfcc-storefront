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
import { data } from 'react-router';
import { BasketAction, createBasketAction } from '@/lib/cart/basket-action.server';
import { createActionError } from '@/lib/action-error-helpers.server';
import { cartItemUpdateSchema } from '@/lib/cart/basket-schemas';
import { ErrorCode } from '@/lib/error-codes';

// @sfdc-extension-line SFDC_EXT_BOPIS
import { handleCartItemDeliveryOptionChange } from '@/extensions/bopis/lib/actions/cart-item-delivery-option-handler.server';

/**
 * Server action for updating a cart item (variant and/or quantity).
 *
 * This action can update:
 * - Product variant (e.g., changing color, size)
 * - Quantity
 * - Both variant and quantity
 *
 * Used by cart edit modal and cart components for updating cart items.
 */
export const action = createBasketAction(
    {
        method: 'PATCH',
        action: BasketAction.CartItemUpdate,
        parse: (fd) => ({
            itemId: fd.get('itemId')?.toString() || '',
            productId: fd.get('productId')?.toString() || undefined,
            quantity: fd.get('quantity')?.toString() || '',
            // @sfdc-extension-block-start SFDC_EXT_BOPIS
            deliveryOption: fd.get('deliveryOption')?.toString() || undefined,
            storeId: fd.get('storeId')?.toString() || undefined,
            inventoryId: fd.get('inventoryId')?.toString() || undefined,
            // @sfdc-extension-block-end SFDC_EXT_BOPIS
        }),
    },
    async ({ input, basketId, context, clients, logger }) => {
        const validationResult = cartItemUpdateSchema.safeParse(input);

        if (!validationResult.success) {
            logger.warn('CartItemUpdate: validation failed', { issues: validationResult.error.issues });
            return data(
                {
                    success: false,
                    error: createActionError({
                        code: ErrorCode.INVALID_INPUT,
                        message: validationResult.error.issues[0]?.message || 'Invalid form data',
                    }),
                },
                { status: 400 }
            );
        }

        const { itemId, productId, quantity } = validationResult.data;

        logger.debug('CartItemUpdate: updating item', { itemId, productId, quantity, basketId });

        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        const response = await handleCartItemDeliveryOptionChange(validationResult.data, context);
        if (response) {
            return response;
        }
        // @sfdc-extension-block-end SFDC_EXT_BOPIS

        const updateBody: { quantity: number; productId?: string } = { quantity };
        if (productId) {
            updateBody.productId = productId;
        }

        const { data: updatedBasket } = await clients.shopperBasketsV2.updateItemInBasket({
            params: {
                path: {
                    basketId,
                    itemId,
                },
            },
            body: updateBody,
        });
        return updatedBasket;
    }
);
