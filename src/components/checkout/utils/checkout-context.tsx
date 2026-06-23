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
import { type ReactNode, useEffect, useState } from 'react';
import {
    CHECKOUT_STEPS,
    CheckoutContext,
    type CheckoutContextValue,
    type CheckoutStep,
    type CustomerProfile,
} from './checkout-context-types';
import { useBasket } from '@/providers/basket';
import type { ShopperCustomers } from '@/scapi';
import { computeFinalStepForReturningCustomer, computeStepFromBasket } from './checkout-utils';
import { getShipmentDistribution } from './checkout-distribution';

interface CheckoutProviderProps {
    children: ReactNode;
    customerProfile?: CustomerProfile;
    shippingDefaultSet: Promise<undefined>;
}

export default function CheckoutProvider({ children, customerProfile, shippingDefaultSet }: CheckoutProviderProps) {
    const basket = useBasket();
    const shipmentDistribution = getShipmentDistribution(basket);
    const [editingStep, setEditingStep] = useState<CheckoutStep | null>(null);
    const [currentStep, setCurrentStep] = useState<CheckoutStep>(CHECKOUT_STEPS.CONTACT_INFO);
    const [isActiveCheckoutFlow, setIsActiveCheckoutFlow] = useState(false);
    const [savedAddresses, setSavedAddresses] = useState<ShopperCustomers.schemas['CustomerAddress'][]>([]);
    // sfdc-extension-line SFDC_EXT_MULTISHIP
    const [productItemAddresses, setProductItemAddresses] = useState<
        Map<string, ShopperCustomers.schemas['CustomerAddress']>
    >(new Map());

    // Get checkout step order based on whether address and options are needed
    const getCheckoutStepOrder = (): CheckoutStep[] => {
        return shipmentDistribution.hasDeliveryItems
            ? [
                  CHECKOUT_STEPS.CONTACT_INFO,
                  CHECKOUT_STEPS.PICKUP,
                  CHECKOUT_STEPS.SHIPPING_ADDRESS,
                  CHECKOUT_STEPS.SHIPPING_OPTIONS,
                  CHECKOUT_STEPS.PAYMENT,
                  CHECKOUT_STEPS.PLACE_ORDER,
              ]
            : [CHECKOUT_STEPS.CONTACT_INFO, CHECKOUT_STEPS.PICKUP, CHECKOUT_STEPS.PAYMENT, CHECKOUT_STEPS.PLACE_ORDER];
    };

    // Compute the initial step from basket or customer profile
    const computedStep = customerProfile
        ? computeFinalStepForReturningCustomer(basket, customerProfile, shipmentDistribution) ||
          computeStepFromBasket(basket, shipmentDistribution)
        : computeStepFromBasket(basket, shipmentDistribution);

    // Update current step when basket changes, but only if not actively editing
    // For active checkout flow, only ignore basket-based step computation for guest users
    // Returning customers should still benefit from auto-population
    useEffect(() => {
        if (editingStep === null) {
            // If we have a customer profile (returning customer), always use basket-based computation
            // If no customer profile (guest user) and active checkout flow, use sequential progression
            if (customerProfile || !isActiveCheckoutFlow) {
                setCurrentStep(computedStep);
            }
        }
    }, [computedStep, editingStep, isActiveCheckoutFlow, customerProfile]);

    // only used for storybook
    const goToNextStep = () => {
        const stepOrder = getCheckoutStepOrder();
        const currentIndex = stepOrder.indexOf(currentStep);
        if (currentIndex < stepOrder.length - 1) {
            const nextStep = stepOrder[currentIndex + 1];
            setEditingStep(nextStep);
        }
    };

    const goToStep = (step: CheckoutStep) => {
        setEditingStep(step);
    };

    // Force shopper back to `step` despite what the basket would compute
    const pinToStep = (step: CheckoutStep) => {
        setEditingStep(step);
        setCurrentStep(step);
        if (!customerProfile) {
            setIsActiveCheckoutFlow(true);
        }
    };

    const exitEditMode = () => {
        const stepOrder = getCheckoutStepOrder();
        const computedStepIndex = stepOrder.indexOf(computedStep);
        const nextIndex = stepOrder.indexOf(currentStep) + 1;
        const bestIndex = nextIndex < computedStepIndex ? nextIndex : computedStepIndex;

        if (!customerProfile && bestIndex < stepOrder.length - 1) {
            // Only mark checkout flow as active for guest users (no customer profile)
            // Returning customers should continue to benefit from auto-population
            setIsActiveCheckoutFlow(true);
            // manual advancement because effect and action advance are disabled for non-edit
            setCurrentStep(stepOrder[bestIndex]);
            setEditingStep(stepOrder[bestIndex]);
        } else {
            setCurrentStep(stepOrder[bestIndex]);
            setEditingStep(null);
        }
    };

    const value: CheckoutContextValue = {
        step: currentStep,
        computedStep,
        editingStep,
        STEPS: CHECKOUT_STEPS,
        customerProfile,
        shippingDefaultSet,
        shipmentDistribution,
        savedAddresses,
        setSavedAddresses,
        // sfdc-extension-block-start SFDC_EXT_MULTISHIP
        productItemAddresses,
        setProductItemAddresses,
        // sfdc-extension-block-end SFDC_EXT_MULTISHIP
        goToNextStep,
        goToStep,
        exitEditMode,
        pinToStep,
    };

    return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}
