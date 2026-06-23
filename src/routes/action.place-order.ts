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
import { redirect } from 'react-router';
import type { Route } from './+types/action.place-order';
import { getBasket, updateBasketResource, destroyBasket } from '@/middlewares/basket.server';
import { getAuth } from '@/middlewares/auth.server';
import { createApiClients } from '@/lib/api-clients.server';
import { routes, routeHref } from '@/route-paths';
import {
    calculateBasket,
    getBasketCurrency,
    addPaymentInstrumentToBasket,
    updateBillingAddressForBasket,
} from '@/lib/api/basket.server';
import {
    savePaymentMethodToCustomerViaOrder,
    type PaymentInstrumentForSave,
    saveShippingAddressToCustomer,
    saveBillingAddressToCustomer,
    updateCustomerContactInfo,
    getCustomerProfileForCheckout,
} from '@/lib/api/customer.server';
import type { CustomerProfile } from '@/components/checkout/utils/checkout-context-types';
import { getAddressBookFromCustomer, getPaymentMethodsFromCustomer } from '@/lib/customer/profile-utils';
import { createActionError } from '@/lib/action-error-helpers.server';
import { ErrorCode } from '@/lib/error-codes';
import { buildUrlFromContext } from '@/lib/url.server';
// @sfdc-extension-line SFDC_EXT_MULTISHIP
import { resolveEmptyShipments } from '@/extensions/multiship/lib/api/basket.server';
import { getLogger } from '@/lib/logger.server';
import { ACTION_HOOK_IDS, runHookSafe } from '@/targets/action-hook.server';

const normalizeAddressField = (value: string | undefined) => (value ?? '').trim().toLowerCase();

const isSameAddress = (
    a:
        | {
              firstName?: string;
              lastName?: string;
              address1?: string;
              address2?: string;
              city?: string;
              stateCode?: string;
              postalCode?: string;
              countryCode?: string;
          }
        | undefined,
    b:
        | {
              firstName?: string;
              lastName?: string;
              address1?: string;
              address2?: string;
              city?: string;
              stateCode?: string;
              postalCode?: string;
              countryCode?: string;
          }
        | undefined
) => {
    if (!a || !b) return false;
    return (
        normalizeAddressField(a.firstName) === normalizeAddressField(b.firstName) &&
        normalizeAddressField(a.lastName) === normalizeAddressField(b.lastName) &&
        normalizeAddressField(a.address1) === normalizeAddressField(b.address1) &&
        normalizeAddressField(a.address2) === normalizeAddressField(b.address2) &&
        normalizeAddressField(a.city) === normalizeAddressField(b.city) &&
        normalizeAddressField(a.stateCode) === normalizeAddressField(b.stateCode) &&
        normalizeAddressField(a.postalCode) === normalizeAddressField(b.postalCode) &&
        normalizeAddressField(a.countryCode) === normalizeAddressField(b.countryCode)
    );
};

const normalizePhoneDigits = (phone: string | undefined): string => (phone ?? '').replace(/\D/g, '');

const PROFILE_SAVE_RETRY_DELAY_MS = 500;

/**
 * Retry wrapper for profile save operations that return boolean.
 * Newly registered accounts can have brief SCAPI auth propagation delays
 * causing the first call to fail; a single retry after a short delay resolves most cases.
 */
async function retryProfileSave(
    fn: () => Promise<boolean>,
    label: string,
    logger: ReturnType<typeof getLogger>
): Promise<void> {
    const ok = await fn();
    if (ok) return;
    logger.warn(`PlaceOrder: ${label} failed, retrying once`);
    await new Promise((r) => setTimeout(r, PROFILE_SAVE_RETRY_DELAY_MS));
    const retried = await fn();
    if (!retried) {
        logger.error(`PlaceOrder: ${label} failed after retry`);
    }
}

function profilePhoneMatchesContact(customer: CustomerProfile['customer'] | undefined, contactPhone: string): boolean {
    if (!customer) {
        return false;
    }
    const incoming = normalizePhoneDigits(contactPhone);
    if (incoming.length < 7) {
        return false;
    }
    return (
        normalizePhoneDigits(customer.phoneHome) === incoming ||
        normalizePhoneDigits(customer.phoneMobile) === incoming ||
        normalizePhoneDigits(customer.phoneBusiness) === incoming
    );
}

/** True when order card matches an existing saved wallet entry (last4 + expiry). */
function orderPaymentMatchesSavedProfile(
    instrument: PaymentInstrumentForSave,
    profile: CustomerProfile | undefined
): boolean {
    if (!profile?.paymentInstruments?.length) {
        return false;
    }
    const saved = getPaymentMethodsFromCustomer(profile);
    if (!saved?.length) {
        return false;
    }
    const card = instrument.paymentCard;
    if (!card) {
        return false;
    }
    let orderLast4 = card.numberLastDigits?.replace(/\D/g, '').slice(-4);
    if (!orderLast4 && card.maskedNumber) {
        orderLast4 = card.maskedNumber.replace(/\D/g, '').slice(-4);
    }
    if (!orderLast4 || orderLast4.length < 4) {
        return false;
    }
    return saved.some((pm) => {
        const pmLast4 = pm.maskedNumber?.replace(/\D/g, '').slice(-4) || '';
        return (
            pmLast4 === orderLast4 &&
            pm.expirationMonth === card.expirationMonth &&
            pm.expirationYear === card.expirationYear
        );
    });
}

/**
 * Server action for placing an order.
 */
export async function action({ request, context }: Route.ActionArgs) {
    const logger = getLogger(context);
    try {
        // Parse form data to get create account preference and save-payment option
        const formData = await request.formData();
        const shouldCreateAccount = formData.get('shouldCreateAccount') === 'true';
        /** Set only when checkout registration OTP flow is active (session registeredViaCheckout). */
        const checkoutRegistrationIntent = formData.get('checkoutRegistrationIntent') === 'true';
        const savePaymentToProfile = formData.get('savePaymentToProfile') === 'true';
        const useDifferentBilling = formData.get('useDifferentBilling') === 'true';

        // Get current basket
        const basketResource = await getBasket(context);
        const basket = basketResource.current;
        logger.debug('PlaceOrder: starting', { basketId: basket?.basketId });

        if (!basket || !basket.basketId) {
            return Response.json(
                {
                    success: false,
                    error: createActionError({
                        code: ErrorCode.NOT_FOUND,
                        message: 'No active basket found',
                    }),
                    step: 'placeOrder',
                },
                { status: 400 }
            );
        }

        // Validate that basket has all required information
        if (!basket.customerInfo?.email) {
            return Response.json(
                {
                    success: false,
                    error: createActionError({
                        code: ErrorCode.REQUIRED_FIELD,
                        message: 'Customer email is required',
                    }),
                    step: 'placeOrder',
                },
                { status: 400 }
            );
        }

        // Build a map of shipmentId -> item count for efficient lookups
        const shipmentItemCounts = new Map<string, number>();
        if (basket.productItems) {
            basket.productItems.forEach((item) => {
                if (item.shipmentId) {
                    shipmentItemCounts.set(item.shipmentId, (shipmentItemCounts.get(item.shipmentId) || 0) + 1);
                }
            });
        }

        // Filter to get only non-empty shipments (shipments with at least one item assigned)
        const nonEmptyShipments = (basket.shipments || []).filter((shipment) => {
            if (!shipment.shipmentId) return false;
            return (shipmentItemCounts.get(shipment.shipmentId) || 0) > 0;
        });

        // Check that all non-empty shipments have shipping address and method
        for (const shipment of nonEmptyShipments) {
            if (!shipment.shippingAddress) {
                return Response.json(
                    {
                        success: false,
                        error: createActionError({
                            code: ErrorCode.REQUIRED_FIELD,
                            message: 'Shipping address is required',
                        }),
                        step: 'placeOrder',
                    },
                    { status: 400 }
                );
            }

            if (!shipment.shippingMethod) {
                return Response.json(
                    {
                        success: false,
                        error: createActionError({
                            code: ErrorCode.REQUIRED_FIELD,
                            message: 'Shipping method is required',
                        }),
                        step: 'placeOrder',
                    },
                    { status: 400 }
                );
            }
        }

        if (!basket.paymentInstruments?.[0]) {
            // Check if this is a returning customer with saved payment methods
            const auth = getAuth(context);
            const customerId = auth.customerId;

            if (customerId) {
                try {
                    const customerProfile = await getCustomerProfileForCheckout(context, customerId);
                    if (!customerProfile) {
                        return Response.json(
                            {
                                success: false,
                                error: createActionError({
                                    code: ErrorCode.NOT_FOUND,
                                    message: 'Unable to load customer profile',
                                }),
                                step: 'placeOrder',
                            },
                            { status: 400 }
                        );
                    }
                    const savedPaymentMethods = getPaymentMethodsFromCustomer(customerProfile);

                    if (savedPaymentMethods.length > 0) {
                        const preferredMethod =
                            savedPaymentMethods.find((method) => method.preferred) || savedPaymentMethods[0];

                        // SFCC requires customerPaymentInstrumentId to charge a saved payment instrument.
                        // paymentCard (cardType, maskedNumber, etc.) is display metadata only and cannot
                        // be used to charge a saved card.
                        const paymentInfo = {
                            paymentMethodId: 'CREDIT_CARD',
                            customerPaymentInstrumentId: preferredMethod.id,
                            amount: basket.orderTotal ?? 0,
                        };

                        // Get billing address (use shipping address or customer's billing address)
                        const billingAddress =
                            basket.shipments?.[0]?.shippingAddress || customerProfile.preferredBillingAddress;

                        if (billingAddress) {
                            // Apply saved payment method to basket
                            const updatedBasket = await addPaymentInstrumentToBasket(
                                context,
                                basket.basketId,
                                paymentInfo
                            );
                            const finalBasket = await updateBillingAddressForBasket(
                                context,
                                basket.basketId,
                                billingAddress
                            );

                            // Update the local basket state
                            const preservedBasket = {
                                ...basket,
                                orderTotal: finalBasket.orderTotal,
                                productTotal: finalBasket.productTotal,
                                shippingTotal: finalBasket.shippingTotal,
                                merchandizeTotalTax: finalBasket.merchandizeTotalTax,
                                taxTotal: finalBasket.taxTotal,
                                paymentInstruments: updatedBasket.paymentInstruments || finalBasket.paymentInstruments,
                                billingAddress: finalBasket.billingAddress,
                            };
                            updateBasketResource(context, preservedBasket);
                        } else {
                            return Response.json(
                                {
                                    success: false,
                                    error: createActionError({
                                        code: ErrorCode.REQUIRED_FIELD,
                                        message: 'Billing address is required',
                                    }),
                                    step: 'placeOrder',
                                },
                                { status: 400 }
                            );
                        }
                    } else {
                        return Response.json(
                            {
                                success: false,
                                error: createActionError({
                                    code: ErrorCode.REQUIRED_FIELD,
                                    message: 'Payment information is required',
                                }),
                                step: 'placeOrder',
                            },
                            { status: 400 }
                        );
                    }
                } catch {
                    return Response.json(
                        {
                            success: false,
                            error: createActionError({
                                code: ErrorCode.OPERATION_FAILED,
                                message: 'Failed to apply saved payment method',
                            }),
                            step: 'placeOrder',
                        },
                        { status: 400 }
                    );
                }
            } else {
                return Response.json(
                    {
                        success: false,
                        error: createActionError({
                            code: ErrorCode.REQUIRED_FIELD,
                            message: 'Payment information is required',
                        }),
                        step: 'placeOrder',
                    },
                    { status: 400 }
                );
            }
        }

        // Get the updated basket after potential payment application
        const updatedBasket = (await getBasket(context)).current;

        if (!updatedBasket?.billingAddress) {
            return Response.json(
                {
                    success: false,
                    error: createActionError({
                        code: ErrorCode.REQUIRED_FIELD,
                        message: 'Billing address is required',
                    }),
                    step: 'placeOrder',
                },
                { status: 400 }
            );
        }

        // @sfdc-extension-line SFDC_EXT_MULTISHIP
        await resolveEmptyShipments(context, updatedBasket);

        const currency = getBasketCurrency(context, updatedBasket);

        if (!updatedBasket?.basketId) {
            return Response.json(
                {
                    success: false,
                    error: createActionError({ code: ErrorCode.NOT_FOUND, message: 'Basket not found' }),
                    step: 'placeOrder',
                },
                { status: 400 }
            );
        }

        const calculatedBasket = await calculateBasket(context, updatedBasket.basketId, currency);

        // Update local basket state with calculated totals
        updateBasketResource(context, calculatedBasket);

        // Extension hook: fraud check before placing the order (blocking — unexpected errors fail the action)
        const fraudHookResult = await runHookSafe({
            hookId: ACTION_HOOK_IDS.CHECKOUT_FRAUD_BEFORE_PLACE,
            context: { data: { basket: calculatedBasket }, actionContext: context },
            logger,
            fallbackStep: 'placeOrder',
            blocking: true,
        });
        if (fraudHookResult.errorResponse) return fraudHookResult.errorResponse;

        // Extension hook: payment processing before order creation (blocking — e.g. authorization)
        const paymentHookResult = await runHookSafe({
            hookId: ACTION_HOOK_IDS.CHECKOUT_PAYMENTS_BEFORE_PLACE_ORDER,
            context: { data: { basket: calculatedBasket }, actionContext: context },
            logger,
            fallbackStep: 'placeOrder',
            blocking: true,
        });
        if (paymentHookResult.errorResponse) return paymentHookResult.errorResponse;

        const clients = createApiClients(context);

        const { data: order } = await clients.shopperOrders.createOrder({
            params: {},
            body: { basketId: calculatedBasket.basketId },
        });

        if (!order || !order.orderNo) {
            logger.error('PlaceOrder: empty order response', { basketId: calculatedBasket.basketId });
            return Response.json(
                {
                    success: false,
                    error: createActionError({
                        code: ErrorCode.OPERATION_FAILED,
                        message: 'Order creation returned empty result',
                    }),
                    step: 'placeOrder',
                },
                { status: 500 }
            );
        }

        const orderNo = order.orderNo;
        logger.info('PlaceOrder: order created', { orderNo, basketId: calculatedBasket.basketId });

        // Extension hook: post-processing after order creation (e.g. capture, fulfillment triggers).
        // Order is already placed — never abort the action. Log at warn level with order
        // details so post-order failures (e.g. failed capture) are surfaced in monitoring.
        const afterPlaceResult = await runHookSafe({
            hookId: ACTION_HOOK_IDS.CHECKOUT_PAYMENTS_AFTER_PLACE_ORDER,
            context: { data: { order, basket: calculatedBasket }, actionContext: context },
            logger,
            fallbackStep: 'placeOrder',
        });
        if (afterPlaceResult.errorResponse) {
            logger.warn('PlaceOrder: afterPlaceOrder hook failed — order already placed, requires manual review', {
                hookId: ACTION_HOOK_IDS.CHECKOUT_PAYMENTS_AFTER_PLACE_ORDER,
                orderNo: order.orderNo,
                basketId: calculatedBasket.basketId,
            });
        }

        // Registration-at-checkout: requires both create-account intent AND active registration session (client flag).
        // Stale sessionStorage.shouldCreateAccount alone must not trigger duplicate profile saves for returning shoppers.
        const auth = getAuth(context);
        const registeredViaCheckout =
            auth.userType === 'registered' &&
            Boolean(auth.customerId) &&
            shouldCreateAccount &&
            checkoutRegistrationIntent;

        // The contact-info phone is passed from the client as a form field because basket
        // transfers during OTP registration can strip phone from the billing address.
        // Fall back to the basket/order/shipment fields if the form field is absent.
        const contactPhone =
            formData.get('contactPhone')?.toString() ||
            updatedBasket.billingAddress?.phone ||
            order.billingAddress?.phone ||
            order.shipments?.[0]?.shippingAddress?.phone ||
            updatedBasket.shipments?.[0]?.shippingAddress?.phone ||
            (updatedBasket.customerInfo as { phone?: string } | undefined)?.phone ||
            (order.customerInfo as { phone?: string } | undefined)?.phone;

        // Save checkout information to customer profile
        if (auth.customerId) {
            const customerId = auth.customerId;
            const savePromises: Promise<unknown>[] = [];

            let profileSnapshot: CustomerProfile | null = null;
            try {
                const loaded = await getCustomerProfileForCheckout(context, customerId);
                if (loaded?.customer) {
                    profileSnapshot = {
                        customer: loaded.customer,
                        addresses: loaded.addresses ?? [],
                        paymentInstruments: loaded.paymentInstruments ?? [],
                        preferredShippingAddress: loaded.preferredShippingAddress,
                        preferredBillingAddress: loaded.preferredBillingAddress,
                    };
                }
            } catch (error) {
                logger.error('PlaceOrder: failed to load customer profile for post-order saves', { error });
            }

            // Detect newly registered shoppers whose profile is still empty (in case they exit checkout without saving)
            let isNewlyRegisteredWithEmptyProfile = false;
            if (auth.userType === 'registered' && !registeredViaCheckout && profileSnapshot?.customer) {
                const c = profileSnapshot.customer;
                isNewlyRegisteredWithEmptyProfile =
                    (!profileSnapshot.addresses || profileSnapshot.addresses.length === 0) && !c.phoneHome;
            }

            const shouldSaveCheckoutDataToProfile = registeredViaCheckout || isNewlyRegisteredWithEmptyProfile;

            // For newly registered customers, save all their checkout info to the customer profile.
            if (shouldSaveCheckoutDataToProfile) {
                const existingAddresses = getAddressBookFromCustomer(profileSnapshot ?? undefined);

                if (order.paymentInstruments?.[0]) {
                    const instrument = order.paymentInstruments[0] as PaymentInstrumentForSave;
                    if (!orderPaymentMatchesSavedProfile(instrument, profileSnapshot ?? undefined)) {
                        savePromises.push(
                            retryProfileSave(
                                () => savePaymentMethodToCustomerViaOrder(context, orderNo, instrument),
                                'payment method save',
                                logger
                            )
                        );
                    }
                }

                // Save shipping address
                if (order.shipments?.[0]?.shippingAddress) {
                    const shippingAddress = order.shipments[0].shippingAddress;
                    const shippingAlreadySaved = existingAddresses.some((address) =>
                        isSameAddress(address, shippingAddress)
                    );
                    if (!shippingAlreadySaved) {
                        savePromises.push(
                            retryProfileSave(
                                () => saveShippingAddressToCustomer(context, customerId, shippingAddress, true),
                                'shipping address save',
                                logger
                            )
                        );
                    }
                }

                // Save billing address only when shopper explicitly selected
                // "use different billing address" in checkout payment.
                if (useDifferentBilling && order.billingAddress) {
                    const orderBillingAddress = order.billingAddress;
                    const billingAlreadySaved = existingAddresses.some((address) =>
                        isSameAddress(address, orderBillingAddress)
                    );
                    if (!billingAlreadySaved) {
                        savePromises.push(
                            retryProfileSave(
                                () => saveBillingAddressToCustomer(context, customerId, orderBillingAddress),
                                'billing address save',
                                logger
                            )
                        );
                    }
                }

                // Save phone number to customer profile (phoneHome)
                if (contactPhone && !profilePhoneMatchesContact(profileSnapshot?.customer, contactPhone)) {
                    savePromises.push(
                        retryProfileSave(
                            () => updateCustomerContactInfo(context, customerId, { phone: contactPhone }),
                            'phone save',
                            logger
                        )
                    );
                }
            }
            // For existing registered customers, only save payment if opted in
            // Do not automatically save addresses to avoid creating duplicates.
            else if (savePaymentToProfile && order.paymentInstruments?.[0]) {
                savePromises.push(
                    savePaymentMethodToCustomerViaOrder(
                        context,
                        orderNo,
                        order.paymentInstruments[0] as PaymentInstrumentForSave
                    ).catch((error) => {
                        logger.error('PlaceOrder: failed to save payment method', { error });
                    })
                );
            }

            // Await profile saves so serverless requests don't terminate before SCAPI calls complete
            if (savePromises.length > 0) {
                await Promise.all(savePromises);
            }
        }

        // Clear the basket from local cache and storage after successful order placement
        // This follows the PWA Kit pattern - destroy locally, let Commerce Cloud handle server-side lifecycle
        // The basket is auto-converted to an order, no explicit deletion needed
        destroyBasket(context);

        // Redirect to order confirmation page on success
        // Include account creation and auto-login status as query parameters if account was created
        let orderConfirmationUrl = buildUrlFromContext(
            routeHref(routes.orderConfirmation, { orderNo: order.orderNo }),
            context
        );

        if (registeredViaCheckout && order.customerInfo?.email) {
            // User registered during checkout - include this in query params for order confirmation
            const params = new URLSearchParams({
                accountCreated: 'true',
                email: order.customerInfo.email,
                autoLoggedIn: 'true',
            });

            orderConfirmationUrl += `?${params.toString()}`;
        }

        return redirect(orderConfirmationUrl);
    } catch (error) {
        return Response.json(
            {
                success: false,
                error: createActionError({ error }),
                step: 'placeOrder',
            },
            { status: 500 }
        );
    }
}
