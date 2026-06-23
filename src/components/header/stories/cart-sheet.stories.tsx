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
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { expect, within } from 'storybook/test';
import CartSheet from '../cart-sheet';
import { Button } from '@/components/ui/button';
import BasketProvider, { useMiniCart } from '@/providers/basket';
import emptyBasket from '@/components/__mocks__/empty-basket';
import emptyBasketSnapshot from '@/components/__mocks__/empty-basket-snapshot';
import { basketWithOneItem } from '@/components/__mocks__/basket-with-dress';
import basketWithOneItemSnapshot from '@/components/__mocks__/basket-with-dress-snapshot';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { mockConfig, mockLocale, mockSiteObject } from '@/test-utils/config';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';

function CartSheetWithState({ children }: { children: ReactNode }): ReactElement {
    const { setMiniCartOpen } = useMiniCart();
    useEffect(() => {
        setMiniCartOpen(true);
    }, [setMiniCartOpen]);
    return <CartSheet>{children}</CartSheet>;
}

const meta: Meta<typeof CartSheet> = {
    title: 'LAYOUT/Header/Cart Sheet',
    component: CartSheet,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Mini cart flyout. Opens automatically; reads basket data via `/resource/basket-products` (mocked in Storybook).',
            },
        },
    },
    decorators: [
        (Story) => (
            <ConfigProvider config={mockConfig}>
                <SiteProvider
                    site={mockSiteObject}
                    locale={mockLocale}
                    language={mockSiteObject.defaultLocale}
                    currency={mockSiteObject.defaultCurrency}>
                    <div className="p-8">
                        <Story />
                    </div>
                </SiteProvider>
            </ConfigProvider>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof CartSheet>;

export const Empty: Story = {
    decorators: [
        (Story) => (
            <BasketProvider basket={emptyBasket} snapshot={emptyBasketSnapshot}>
                <Story />
            </BasketProvider>
        ),
    ],
    render: () => (
        <CartSheetWithState>
            <Button variant="ghost">Open Cart</Button>
        </CartSheetWithState>
    ),
    parameters: {
        snapshot: false, // Radix UI Sheet with empty state causes infinite loop in test environment
        // Override the default populated /resource/basket-products fixture so the cart sheet sees
        // an empty basket — the cart-sheet panel reads basket through the resource route's
        // fetcher, not through the BasketProvider decorator wrapping this story.
        miniCartData: { basket: emptyBasket, productsById: {} },
    },
    play: async () => {
        const documentBody = within(document.body);
        const cartSheet = await documentBody.findByRole('dialog', { hidden: false }, { timeout: 5000 });
        await expect(cartSheet).toBeInTheDocument();
        await expect(await documentBody.findByText(/your cart is empty/i, {}, { timeout: 5000 })).toBeInTheDocument();
    },
};

export const WithItems: Story = {
    decorators: [
        (Story) => (
            <BasketProvider basket={basketWithOneItem} snapshot={basketWithOneItemSnapshot}>
                <Story />
            </BasketProvider>
        ),
    ],
    render: () => (
        <CartSheetWithState>
            <Button variant="ghost">Open Cart</Button>
        </CartSheetWithState>
    ),
    play: async () => {
        const documentBody = within(document.body);
        const cartSheet = await documentBody.findByRole('dialog', { hidden: false }, { timeout: 5000 });
        await expect(cartSheet).toBeInTheDocument();
        await expect(
            await documentBody.findByRole('link', { name: /checkout/i }, { timeout: 5000 })
        ).toBeInTheDocument();
        await expect(
            await documentBody.findByRole('button', { name: /continue shopping/i }, { timeout: 5000 })
        ).toBeInTheDocument();
    },
};
