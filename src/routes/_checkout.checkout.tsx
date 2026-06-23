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
import { use, useLayoutEffect } from 'react';
import type { ShouldRevalidateFunctionArgs } from 'react-router';
import { loader, type CheckoutPageData } from '@/lib/checkout/loaders.server';
import { createPage, type RouteComponentProps } from '@/components/create-page';
import type { Route } from './+types/_checkout.checkout';
import { SeoMeta } from '@/components/seo-meta';
import { useTranslation } from 'react-i18next';
import CheckoutFormPage from '@/components/checkout/checkout-form-page';
import CheckoutProvider from '@/components/checkout/utils/checkout-context';
import { CheckoutErrorBoundary } from '@/components/checkout-error-boundary';
import { CheckoutSkeleton } from '@/components/checkout/components/checkout-skeletons';
import { useBasketUpdater } from '@/providers/basket';
import { useToast } from '@/components/toast';
// @sfdc-extension-line SFDC_EXT_BOPIS
import PickupProvider from '@/extensions/bopis/context/pickup-context';
import GoogleCloudApiProvider from '@/providers/google-cloud-api';
import { CHECKOUT_ACTION_INTENTS } from '@/components/checkout/utils/checkout-context-types';
import { action as submitContactInfo } from '@/lib/checkout/actions/submit-contact-info.server';
import { action as submitShippingAddress } from '@/lib/checkout/actions/submit-shipping-address.server';
import { action as submitShippingOptions } from '@/lib/checkout/actions/submit-shipping-options.server';
import { action as submitPayment } from '@/lib/checkout/actions/submit-payment.server';
import { getLogger } from '@/lib/logger.server';

export { loader };

/**
 * Skip loader revalidation when an action redirects (3xx).
 *
 * Place-order actions (`/action/place-order`, `/action/payment-redirect-finalize`,
 * `/action/payment-express-complete`) destroy the basket as part of their
 * post-success teardown (see `src/lib/payment/post-order.server.ts`) and then
 * 302 to `/order-confirmation/<orderNo>`. Default revalidation would re-run the
 * checkout loader against the now-destroyed basket, causing the page to render
 * with `basket = null` for one frame and unmount mid-flow — this disrupts
 * payment-extension components that need to stay mounted until the redirect
 * navigation completes (e.g., for cleanup / final PSP iframe acks). Skipping
 * revalidation on 3xx avoids the unmount; the destination route's loaders run
 * fresh after the navigation.
 *
 * For 4xx/5xx responses, React Router already sets `defaultShouldRevalidate`
 * to `false`, so the `defaultShouldRevalidate` return below preserves that
 * behavior. For 2xx responses without a redirect (e.g., regular form
 * submissions like contact-info or shipping updates), revalidation runs as
 * normal so the UI sees fresh data.
 *
 * @see https://reactrouter.com/start/framework/route-module#shouldrevalidate
 */
export function shouldRevalidate({ actionStatus, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
    if (actionStatus !== undefined && actionStatus >= 300 && actionStatus < 400) {
        return false;
    }
    return defaultShouldRevalidate;
}

export async function action({ request, context }: Route.ActionArgs) {
    const logger = getLogger(context);
    const formData = await request.formData();
    const intent = formData.get('intent')?.toString();

    logger.debug('Checkout: action dispatching', { intent });

    switch (intent) {
        case CHECKOUT_ACTION_INTENTS.CONTACT_INFO:
            return submitContactInfo(formData, context);
        case CHECKOUT_ACTION_INTENTS.SHIPPING_ADDRESS:
            return submitShippingAddress(formData, context);
        case CHECKOUT_ACTION_INTENTS.SHIPPING_OPTIONS:
            return submitShippingOptions(formData, context);
        case CHECKOUT_ACTION_INTENTS.PAYMENT:
            return submitPayment(formData, context);
        default:
            logger.warn('Checkout: unknown action intent', { intent });
            return Response.json({ success: false, error: 'Invalid action intent' }, { status: 400 });
    }
}

function CheckoutView({
    loaderData: {
        basket,
        customerProfile,
        shippingMethodsMap,
        productMap,
        promotions,
        emailVerificationEnabled,
        shippingDefaultSet,
        // @sfdc-extension-line SFDC_EXT_BOPIS
        storesByStoreId,
    },
}: RouteComponentProps<CheckoutPageData>) {
    const { t } = useTranslation('checkout');
    // Imperatively update root BasketProvider with loader basket
    // This ensures cart badge and other components see the updated basket
    const updateBasket = useBasketUpdater();
    const { addToast } = useToast();
    useLayoutEffect(() => {
        if (basket?.basketId) {
            updateBasket(basket);
        }
    }, [basket, updateBasket]);

    // Block rendering if basket is not available
    if (!basket?.basketId) {
        return <CheckoutSkeleton />;
    }

    const customerProfileData = customerProfile ? use(customerProfile) : null;
    const shippingMethodsMapData = shippingMethodsMap ? use(shippingMethodsMap) : {};

    const content = (
        <>
            <SeoMeta title={t('meta.title', { defaultValue: 'Checkout' })} noIndex />
            <CheckoutProvider
                customerProfile={customerProfileData ?? undefined}
                shippingDefaultSet={shippingDefaultSet ?? Promise.resolve(undefined)}>
                <CheckoutFormPage
                    shippingMethodsMap={shippingMethodsMapData}
                    productMapPromise={productMap}
                    promotionsPromise={promotions}
                    showToast={addToast}
                    emailVerificationEnabled={emailVerificationEnabled}
                />
            </CheckoutProvider>
        </>
    );

    let finalContent = content;
    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    /// Initialize PickupProvider with stores by store id
    finalContent = <PickupProvider initialPickupStores={storesByStoreId}>{content}</PickupProvider>;
    // @sfdc-extension-block-end SFDC_EXT_BOPIS

    finalContent = <GoogleCloudApiProvider>{finalContent}</GoogleCloudApiProvider>;

    return finalContent;
}

const CheckoutPageWithErrorBoundary = createPage({
    component: CheckoutView,
    fallback: <CheckoutSkeleton />,
});

function CheckoutPage(props: RouteComponentProps<CheckoutPageData>) {
    return (
        <CheckoutErrorBoundary>
            <CheckoutPageWithErrorBoundary {...props} />
        </CheckoutErrorBoundary>
    );
}

export default CheckoutPage;
