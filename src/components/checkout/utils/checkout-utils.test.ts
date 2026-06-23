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
import { describe, expect, it } from 'vitest';
import type { ShopperBasketsV2 } from '@/scapi';
import { CHECKOUT_STEPS, type CustomerProfile } from './checkout-context-types';
import {
    computeFinalStepForReturningCustomer,
    computeStepFromBasket,
    getCompletedSteps,
    hasAnyValidShippingMethod,
    shouldAutoAdvanceForReturningCustomer,
} from './checkout-utils';

// Mock shipment distribution for tests (default: no pickup items)
const mockShipmentDistribution = {
    hasPickupItems: false,
    hasDeliveryItems: true,
    enableMultiAddress: false,
    hasMultipleDeliveryAddresses: false,
    hasUnaddressedDeliveryItems: false,
    needsShippingMethods: false,
    hasEmptyShipments: false,
    isDeliveryProductItem: () => false as const,
    deliveryShipments: [] as ShopperBasketsV2.schemas['Shipment'][],
};

describe('Checkout Utils', () => {
    describe('computeStepFromBasket', () => {
        it('should return CONTACT_INFO when basket is undefined', () => {
            const result = computeStepFromBasket(undefined, mockShipmentDistribution);
            expect(result).toBe(CHECKOUT_STEPS.CONTACT_INFO);
        });

        it('should return CONTACT_INFO when no customer email', () => {
            const basket = {
                basketId: 'test-basket',
                customerInfo: {},
            } as ShopperBasketsV2.schemas['Basket'];

            const result = computeStepFromBasket(basket, mockShipmentDistribution);
            expect(result).toBe(CHECKOUT_STEPS.CONTACT_INFO);
        });

        it('should return SHIPPING_ADDRESS when email exists but no shipping address', () => {
            const basket = {
                basketId: 'test-basket',
                customerInfo: { email: 'test@example.com' },
                shipments: [{}],
            } as ShopperBasketsV2.schemas['Basket'];

            const distributionWithUnaddressedItems = {
                ...mockShipmentDistribution,
                hasUnaddressedDeliveryItems: true,
                needsShippingMethods: false,
            };
            const result = computeStepFromBasket(basket, distributionWithUnaddressedItems);
            expect(result).toBe(CHECKOUT_STEPS.SHIPPING_ADDRESS);
        });

        it('should return SHIPPING_OPTIONS when shipping address exists but no shipping method', () => {
            const basket = {
                basketId: 'test-basket',
                customerInfo: { email: 'test@example.com' },
                shipments: [
                    {
                        shippingAddress: {
                            firstName: 'John',
                            lastName: 'Doe',
                            address1: '123 Main St',
                            city: 'Anytown',
                            stateCode: 'CA',
                            postalCode: '12345',
                            countryCode: 'US',
                        },
                    },
                ],
            } as ShopperBasketsV2.schemas['Basket'];

            const distributionNeedingMethods = {
                ...mockShipmentDistribution,
                hasUnaddressedDeliveryItems: false,
                needsShippingMethods: true,
            };
            const result = computeStepFromBasket(basket, distributionNeedingMethods);
            expect(result).toBe(CHECKOUT_STEPS.SHIPPING_OPTIONS);
        });

        it('should return PAYMENT when shipping method exists but no payment', () => {
            const basket = {
                basketId: 'test-basket',
                customerInfo: { email: 'test@example.com' },
                shipments: [
                    {
                        shipmentId: 'me',
                        shippingAddress: {
                            firstName: 'John',
                            lastName: 'Doe',
                            address1: '123 Main St',
                            city: 'Anytown',
                            stateCode: 'CA',
                            postalCode: '12345',
                            countryCode: 'US',
                        },
                        shippingMethod: {
                            id: 'standard',
                            name: 'Standard Shipping',
                        },
                    },
                ],
                paymentInstruments: [],
            } as ShopperBasketsV2.schemas['Basket'];

            const result = computeStepFromBasket(basket, mockShipmentDistribution); // User has selected shipping options
            expect(result).toBe(CHECKOUT_STEPS.PAYMENT);
        });

        it('should return PLACE_ORDER when all required fields are present', () => {
            const basket = {
                basketId: 'test-basket',
                customerInfo: { email: 'test@example.com' },
                shipments: [
                    {
                        shippingAddress: {
                            firstName: 'John',
                            lastName: 'Doe',
                            address1: '123 Main St',
                            city: 'Anytown',
                            stateCode: 'CA',
                            postalCode: '12345',
                            countryCode: 'US',
                        },
                        shippingMethod: {
                            id: 'standard',
                            name: 'Standard Shipping',
                        },
                    },
                ],
                paymentInstruments: [
                    {
                        paymentMethodId: 'CREDIT_CARD',
                        paymentCard: {
                            cardType: 'Visa',
                            expirationMonth: 12,
                            expirationYear: 2025,
                            maskedNumber: '************1234',
                        },
                    },
                ],
            } as ShopperBasketsV2.schemas['Basket'];

            const result = computeStepFromBasket(basket, mockShipmentDistribution);
            expect(result).toBe(CHECKOUT_STEPS.PLACE_ORDER);
        });

        it('should stay at SHIPPING_OPTIONS when user has not selected shipping yet', () => {
            const basket = {
                basketId: 'test-basket',
                customerInfo: { email: 'test@example.com' },
                shipments: [
                    {
                        shippingAddress: {
                            firstName: 'John',
                            lastName: 'Doe',
                            address1: '123 Main St',
                            city: 'Anytown',
                            stateCode: 'CA',
                            postalCode: '12345',
                            countryCode: 'US',
                        },
                        shippingMethod: undefined,
                    },
                ],
            } as ShopperBasketsV2.schemas['Basket'];

            const distributionNeedingMethods = {
                ...mockShipmentDistribution,
                hasUnaddressedDeliveryItems: false,
                needsShippingMethods: true,
            };
            const result = computeStepFromBasket(basket, distributionNeedingMethods); // User hasn't completed shipping options
            expect(result).toBe(CHECKOUT_STEPS.SHIPPING_OPTIONS);
        });
    });

    describe('getCompletedSteps', () => {
        it('should return empty array when basket is undefined', () => {
            const result = getCompletedSteps(undefined, mockShipmentDistribution, CHECKOUT_STEPS.CONTACT_INFO);
            expect(result).toEqual([]);
        });

        it('should return completed steps based on basket state', () => {
            const basket = {
                basketId: 'test-basket',
                customerInfo: { email: 'test@example.com' },
                shipments: [
                    {
                        shippingAddress: {
                            firstName: 'John',
                            lastName: 'Doe',
                            address1: '123 Main St',
                            city: 'Anytown',
                            stateCode: 'CA',
                            postalCode: '12345',
                            countryCode: 'US',
                        },
                    },
                ],
            } as ShopperBasketsV2.schemas['Basket'];

            const result = getCompletedSteps(basket, mockShipmentDistribution, CHECKOUT_STEPS.SHIPPING_OPTIONS);
            expect(result).toContain(CHECKOUT_STEPS.CONTACT_INFO);
            expect(result).toContain(CHECKOUT_STEPS.SHIPPING_ADDRESS);
            expect(result).not.toContain(CHECKOUT_STEPS.SHIPPING_OPTIONS);
        });

        it('should handle empty customer info without sessionStorage', () => {
            const basket = {
                basketId: 'test-basket',
                customerInfo: {},
            } as ShopperBasketsV2.schemas['Basket'];

            // Mock sessionStorage to be undefined (server-side)
            Object.defineProperty(window, 'sessionStorage', {
                value: undefined,
                writable: true,
            });

            const result = getCompletedSteps(basket, mockShipmentDistribution, CHECKOUT_STEPS.SHIPPING_ADDRESS);
            expect(result).not.toContain(CHECKOUT_STEPS.CONTACT_INFO);
        });
    });

    describe('shouldAutoAdvanceForReturningCustomer', () => {
        it('should return false for non-returning customers', () => {
            const result = shouldAutoAdvanceForReturningCustomer(false);
            expect(result).toBe(false);
        });

        it('should return false when customer profile is missing', () => {
            const result = shouldAutoAdvanceForReturningCustomer(true, undefined);
            expect(result).toBe(false);
        });

        it('should return false when customer has no saved data', () => {
            const customerProfile = {
                customer: { login: 'test@example.com' },
                addresses: [],
                paymentInstruments: [],
            } as CustomerProfile;

            const result = shouldAutoAdvanceForReturningCustomer(true, customerProfile);
            expect(result).toBe(false);
        });

        it('should return true when customer has both saved addresses and payment methods', () => {
            const customerProfile = {
                customer: { login: 'test@example.com' },
                addresses: [
                    {
                        addressId: 'addr_1',
                        firstName: 'John',
                        lastName: 'Doe',
                        address1: '123 Main St',
                        city: 'Anytown',
                        stateCode: 'CA',
                        postalCode: '12345',
                        countryCode: 'US',
                    },
                ],
                paymentInstruments: [
                    {
                        paymentInstrumentId: 'card_123',
                        paymentMethodId: 'CREDIT_CARD',
                    },
                ],
            } as CustomerProfile;

            const result = shouldAutoAdvanceForReturningCustomer(true, customerProfile);
            expect(result).toBe(true);
        });

        it('should return false when customer has only payment methods without addresses', () => {
            const customerProfile = {
                customer: { login: 'test@example.com' },
                addresses: [],
                paymentInstruments: [
                    {
                        paymentInstrumentId: 'card_123',
                        paymentMethodId: 'CREDIT_CARD',
                    },
                ],
            } as CustomerProfile;

            const result = shouldAutoAdvanceForReturningCustomer(true, customerProfile);
            expect(result).toBe(false); // Needs BOTH addresses AND payment methods
        });
    });

    describe('computeFinalStepForReturningCustomer', () => {
        it('should return null when customer profile is missing', () => {
            const basket = { basketId: 'test' } as ShopperBasketsV2.schemas['Basket'];
            const result = computeFinalStepForReturningCustomer(
                basket,
                undefined as unknown as CustomerProfile,
                mockShipmentDistribution
            );
            expect(result).toBeNull();
        });

        it('should return CONTACT_INFO when no email is available', () => {
            const basket = {
                basketId: 'test',
                customerInfo: {},
            } as ShopperBasketsV2.schemas['Basket'];

            const customerProfile = {
                customer: {},
                addresses: [],
                paymentInstruments: [],
            } as CustomerProfile;

            const result = computeFinalStepForReturningCustomer(basket, customerProfile, mockShipmentDistribution);
            expect(result).toBe(CHECKOUT_STEPS.CONTACT_INFO);
        });

        it('should return SHIPPING_ADDRESS when email exists but no shipping address', () => {
            const basket = {
                basketId: 'test',
                customerInfo: { email: 'test@example.com' },
                shipments: [{}],
            } as ShopperBasketsV2.schemas['Basket'];

            const customerProfile = {
                customer: { login: 'test@example.com' },
                addresses: [],
                paymentInstruments: [],
            } as CustomerProfile;

            const distributionWithUnaddressedItems = {
                ...mockShipmentDistribution,
                hasUnaddressedDeliveryItems: true,
            };
            const result = computeFinalStepForReturningCustomer(
                basket,
                customerProfile,
                distributionWithUnaddressedItems
            );
            expect(result).toBe(CHECKOUT_STEPS.SHIPPING_ADDRESS);
        });

        it('should return PLACE_ORDER when customer has complete profile data', () => {
            const basket = {
                basketId: 'test',
                customerInfo: { email: 'test@example.com' },
            } as ShopperBasketsV2.schemas['Basket'];

            const customerProfile = {
                customer: { login: 'test@example.com' },
                addresses: [{ addressId: 'addr_1', countryCode: 'US', lastName: 'Doe' }],
                paymentInstruments: [
                    {
                        paymentInstrumentId: 'card_123',
                        paymentMethodId: 'CREDIT_CARD',
                    },
                ],
            } as CustomerProfile;

            const result = computeFinalStepForReturningCustomer(basket, customerProfile, mockShipmentDistribution);
            expect(result).toBe(CHECKOUT_STEPS.PLACE_ORDER);
        });

        it('should return PAYMENT when customer has addresses but no saved payment methods', () => {
            const basket = {
                basketId: 'test',
                customerInfo: { email: 'test@example.com' },
            } as ShopperBasketsV2.schemas['Basket'];

            const customerProfile = {
                customer: { login: 'test@example.com' },
                addresses: [{ addressId: 'addr_1', countryCode: 'US', lastName: 'Doe' }],
                paymentInstruments: [],
            } as CustomerProfile;

            const result = computeFinalStepForReturningCustomer(basket, customerProfile, mockShipmentDistribution);
            expect(result).toBe(CHECKOUT_STEPS.PAYMENT);
        });

        it('should return PLACE_ORDER when customer has addresses and valid payment instrument in basket, even without saved payment methods', () => {
            const basket = {
                basketId: 'test',
                customerInfo: { email: 'test@example.com' },
                paymentInstruments: [
                    {
                        paymentMethodId: 'CREDIT_CARD',
                        paymentCard: {
                            cardType: 'Visa',
                            expirationMonth: 12,
                            expirationYear: 2025,
                            maskedNumber: '************1234',
                        },
                    },
                ],
            } as ShopperBasketsV2.schemas['Basket'];

            const customerProfile = {
                customer: { login: 'test@example.com' },
                addresses: [{ addressId: 'addr_1', countryCode: 'US', lastName: 'Doe' }],
                paymentInstruments: [],
            } as CustomerProfile;

            const result = computeFinalStepForReturningCustomer(basket, customerProfile, mockShipmentDistribution);
            expect(result).toBe(CHECKOUT_STEPS.PLACE_ORDER);
        });
    });

    describe('hasAnyValidShippingMethod', () => {
        it('returns false for undefined map', () => {
            expect(hasAnyValidShippingMethod(undefined)).toBe(false);
        });

        it('returns false for empty map', () => {
            expect(hasAnyValidShippingMethod({})).toBe(false);
        });

        it('returns false when shipment has empty applicableShippingMethods', () => {
            expect(hasAnyValidShippingMethod({ me: { applicableShippingMethods: [] } })).toBe(false);
        });

        it('returns false when shipment has no applicableShippingMethods key', () => {
            expect(hasAnyValidShippingMethod({ me: {} })).toBe(false);
        });

        it('returns false when methods exist but are invalid (missing id/name/price)', () => {
            expect(
                hasAnyValidShippingMethod({
                    me: {
                        applicableShippingMethods: [
                            { name: 'Ground', price: 5 } as ShopperBasketsV2.schemas['ShippingMethod'],
                        ],
                    },
                })
            ).toBe(false);
        });

        it('returns false when price is NaN', () => {
            expect(
                hasAnyValidShippingMethod({
                    me: { applicableShippingMethods: [{ id: '001', name: 'Ground', price: NaN }] },
                })
            ).toBe(false);
        });

        it('returns true when at least one method has id, name, and numeric price', () => {
            expect(
                hasAnyValidShippingMethod({
                    me: { applicableShippingMethods: [{ id: '001', name: 'Ground', price: 5 }] },
                })
            ).toBe(true);
        });

        it('returns true when free shipping (price 0) is valid', () => {
            expect(
                hasAnyValidShippingMethod({
                    me: { applicableShippingMethods: [{ id: '002', name: 'Free', price: 0 }] },
                })
            ).toBe(true);
        });

        it('returns true when any shipment in a multi-shipment map has a valid method', () => {
            expect(
                hasAnyValidShippingMethod({
                    s1: { applicableShippingMethods: [] },
                    s2: { applicableShippingMethods: [{ id: '001', name: 'Ground', price: 5 }] },
                })
            ).toBe(true);
        });
    });
});
