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
import { createPromoCodeFormSchema } from '@/components/promo-code-form';
import { getTranslation } from '@salesforce/storefront-next-runtime/i18n';
import { ErrorCode } from '@/lib/error-codes';

/**
 * Server action for adding a promo code to the shopping basket.
 *
 * @example
 * ```tsx
 * <form method="POST" action="/action/promo-code-add">
 *   <input name="promoCode" value="SAVE10" />
 *   <button type="submit">Apply Code</button>
 * </form>
 * ```
 */
export const action = createBasketAction(
    {
        method: 'POST',
        action: BasketAction.PromoCodeAdd,
        parse: (fd) => ({ promoCode: fd.get('promoCode') as string }),
    },
    async ({ input, basketId, clients, logger }) => {
        const { t } = getTranslation();
        const promoCodeFormSchema = createPromoCodeFormSchema(t);
        const validationResult = promoCodeFormSchema.safeParse({ code: input.promoCode });

        if (!validationResult.success) {
            logger.warn('PromoCodeAdd: validation failed');
            return data(
                {
                    success: false,
                    error: createActionError({
                        code: ErrorCode.INVALID_INPUT,
                        message: validationResult.error.issues[0]?.message || 'Promo code is required',
                    }),
                },
                { status: 400 }
            );
        }

        const { code: validatedPromoCode } = validationResult.data;
        logger.debug('PromoCodeAdd: starting', { basketId });

        const { data: updatedBasket } = await clients.shopperBasketsV2.addCouponToBasket({
            params: {
                path: { basketId },
            },
            body: {
                code: validatedPromoCode,
            },
        });
        return updatedBasket;
    }
);
