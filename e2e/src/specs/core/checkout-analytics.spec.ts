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

Feature('Storefront Checkout Analytics Tests').tag('@core').tag('@checkout').tag('@analytics');

// TODO: Skipped pending fix to CheckoutPage.fillContactInfo —
// "Continue to Shipping Address" click times out on pool topology since
// 2026-06-01. Re-enable when the checkout team lands the fix.
const isBroken = true;
const scenarioFn = isBroken ? Scenario.skip : Scenario;

const { checkoutPage, apiCartSetupFlow, storefrontPage, beaconCaptureFlow } = inject();
import { expect } from 'chai';
import { TEST_PRODUCT_CATEGORIES, generateTestEmail } from '../../test-data/checkout.data';

/**
 * Checkout Analytics - checkout_start event with checkoutType
 *
 * Validates that checkout_start events include the checkoutType attribute
 * with value 'one-click' when sent to Einstein.
 */
scenarioFn('Checkout start event should include checkoutType attribute', async () => {
    await beaconCaptureFlow.setupInterception('beginCheckout');

    storefrontPage.navigate();
    await storefrontPage.handleTrackingConsent(true);

    await apiCartSetupFlow.executeAndNavigateToCheckout(TEST_PRODUCT_CATEGORIES.MENS_JACKETS);
    checkoutPage.validatePageLoaded();

    const capturedBeacons = await beaconCaptureFlow.retrieveBeacons(30000);

    expect(capturedBeacons.length, 'Should have captured at least one Einstein beacon').to.be.greaterThan(0);

    const checkoutStartBeacon = capturedBeacons.find((beacon) => beacon.url.includes('beginCheckout'));
    expect(checkoutStartBeacon, 'Should have captured checkout_start (beginCheckout) beacon').to.not.be.undefined;
    expect(checkoutStartBeacon?.payload.checkoutType, 'checkoutType should be present in payload').to.equal(
        'one-click'
    );
}).tag('@checkout-start');

/**
 * Checkout Analytics - checkout_step event with checkoutType
 *
 * Validates that checkout_step events include the checkoutType attribute
 * with value 'one-click' when sent to Einstein.
 */
scenarioFn('Checkout step event should include checkoutType attribute', async () => {
    await beaconCaptureFlow.setupInterception('checkoutStep');

    storefrontPage.navigate();
    await storefrontPage.handleTrackingConsent(true);

    await apiCartSetupFlow.executeAndNavigateToCheckout(TEST_PRODUCT_CATEGORIES.MENS_JACKETS);
    checkoutPage.validatePageLoaded();

    await checkoutPage.fillContactInfo(generateTestEmail('analytics-step'));

    const capturedBeacons = await beaconCaptureFlow.retrieveBeacons(30000);

    expect(capturedBeacons.length, 'Should have captured at least one Einstein beacon').to.be.greaterThan(0);

    const checkoutStepBeacon = capturedBeacons.find((beacon) => beacon.url.includes('checkoutStep'));
    expect(checkoutStepBeacon, 'Should have captured checkout_step (checkoutStep) beacon').to.not.be.undefined;
    expect(checkoutStepBeacon?.payload.checkoutType, 'checkoutType should be present in payload').to.equal('one-click');
}).tag('@checkout-step');

export {};
