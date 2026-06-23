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
import { type ReactElement, useMemo, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import type { ShopperBasketsV2, ShopperProducts } from '@/scapi';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useToast } from '@/components/toast';
import { getBonusProductCountsForPromotion } from '@/lib/cart/bonus-product-utils';
import { requiresVariantSelection, getPrimaryProductImageUrl, isRuleBasedPromotion } from '@/lib/product/product-utils';
import { useRuleBasedBonusProducts } from '@/hooks/use-rule-based-bonus-products';
import { useConfig } from '@salesforce/storefront-next-runtime/config';
import { toImageUrl } from '@/lib/images/dynamic-image';
import { formatCurrency } from '@/lib/currency';
import { useSite } from '@salesforce/storefront-next-runtime/site-context';
import { getPriceData } from '@/components/product-price/utils';
import { resourceRoutes } from '@/route-paths';

interface BonusProductSelectionProps {
    bonusDiscountLineItem: ShopperBasketsV2.schemas['BonusDiscountLineItem'];
    bonusProductsById: Record<string, ShopperProducts.schemas['Product']>;
    basket: ShopperBasketsV2.schemas['Basket'];
    promotionName?: string;
    onProductSelect: (productId: string, productName: string, requiresModal: boolean) => void;
}

export default function BonusProductSelection({
    bonusDiscountLineItem,
    bonusProductsById,
    basket,
    promotionName,
    onProductSelect,
}: BonusProductSelectionProps): ReactElement {
    const addToCartFetcher = useFetcher();
    const { addToast } = useToast();
    const { t, i18n } = useTranslation();
    const config = useConfig();
    const { currency } = useSite();

    // Track processed fetcher data to prevent duplicate toasts
    const processedDataRef = useRef<typeof addToCartFetcher.data>(null);

    // Check if this is a rule-based promotion
    const isRuleBased = isRuleBasedPromotion(bonusDiscountLineItem);

    // Fetch rule-based products if needed
    const { products: ruleBasedProducts } = useRuleBasedBonusProducts(
        isRuleBased && bonusDiscountLineItem.promotionId ? [bonusDiscountLineItem.promotionId] : [],
        {
            enabled: isRuleBased,
            limit: config.pages.cart.ruleBasedProductLimit,
        }
    );

    // Calculate selection counts
    const { selectedBonusItems, maxBonusItems } = getBonusProductCountsForPromotion(
        basket,
        bonusDiscountLineItem.promotionId || ''
    );

    // Build title
    const titleText = promotionName || t('cart:bonusProducts.defaultTitle');
    const titleSuffix = t('cart:bonusProducts.selectionCount', {
        selected: selectedBonusItems,
        max: maxBonusItems,
    });

    // Get bonus products with full data
    const bonusProducts = useMemo(() => {
        //list-based products
        const listBasedProducts =
            bonusDiscountLineItem.bonusProducts
                ?.map((productLink) => {
                    const product = bonusProductsById[productLink.productId];
                    if (!product) return null;

                    return {
                        productId: productLink.productId,
                        productName: productLink.productName || product.name || 'Product',
                        imageAlt:
                            product.imageGroups?.[0]?.images?.[0]?.alt || productLink.productName || product.name || '',
                        imageUrl: getPrimaryProductImageUrl(product, 'large', product.variationValues),
                        product,
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null) || [];

        //rule-based products
        const ruleBasedProductsList =
            isRuleBased && ruleBasedProducts
                ? ruleBasedProducts
                      .filter((product) => product.productId || product.id)
                      .map((product) => {
                          const productId = (product.productId || product.id || '') as string;
                          return {
                              productId,
                              productName: product.productName || 'Product',
                              imageAlt: product.image?.alt || product.productName || '',
                              imageUrl: product.image?.disBaseLink ?? product.image?.link ?? '',
                              product: product as unknown as ShopperProducts.schemas['Product'],
                          };
                      })
                : [];

        // Merge list-based and rule-based products
        const allProducts = [...listBasedProducts, ...ruleBasedProductsList];

        // Deduplicate by productId
        return allProducts.filter(
            (product, index, self) => index === self.findIndex((p) => p.productId === product.productId)
        );
    }, [isRuleBased, ruleBasedProducts, bonusDiscountLineItem.bonusProducts, bonusProductsById]);

    // Handle direct add-to-cart result
    // Only process new responses to prevent duplicate toasts on re-renders
    useEffect(() => {
        if (addToCartFetcher.state === 'idle' && addToCartFetcher.data) {
            // Only process if this is new data we haven't seen before
            if (processedDataRef.current !== addToCartFetcher.data) {
                processedDataRef.current = addToCartFetcher.data;

                if (!addToCartFetcher.data.success) {
                    addToast(
                        t('product:bonusProducts.failedToAdd', {
                            error: addToCartFetcher.data.error?.message || t('product:unknownError'),
                        }),
                        'error'
                    );
                }
            }
        }
    }, [addToCartFetcher.state, addToCartFetcher.data, addToast, t]);

    const handleSelectProduct = (
        productId: string,
        productName: string,
        product: ShopperProducts.schemas['Product']
    ) => {
        const needsModal = requiresVariantSelection(product);

        if (needsModal) {
            // Open modal for variant selection
            onProductSelect(productId, productName, true);
        } else {
            // Validate required IDs before submission
            if (!bonusDiscountLineItem.id || !bonusDiscountLineItem.promotionId) {
                addToast(
                    t('product:bonusProducts.failedToAdd', {
                        error: t('product:bonusProducts.missingRequiredInfo'),
                    }),
                    'error'
                );
                return;
            }

            // Direct add to cart for standard products
            const bonusItems = [
                {
                    productId,
                    quantity: 1,
                    bonusDiscountLineItemId: bonusDiscountLineItem.id,
                    promotionId: bonusDiscountLineItem.promotionId,
                },
            ];

            const formData = new FormData();
            formData.append('bonusItems', JSON.stringify(bonusItems));

            void addToCartFetcher.submit(formData, {
                method: 'POST',
                action: resourceRoutes.bonusProductAdd,
            });
        }
    };

    return (
        <section
            aria-label="Bonus Product Bundle"
            className="w-full overflow-hidden rounded-none border border-border bg-[var(--bg-input-30)] p-4">
            <h3 className="text-base leading-6 text-card-foreground font-sans pb-3">
                <span className="font-semibold">{titleText}</span>
                <span className="font-normal">{titleSuffix}</span>
            </h3>
            <Carousel opts={{ align: 'start' }} className="w-full">
                <div className="relative">
                    <CarouselContent className="-ml-3 justify-start">
                        {bonusProducts.map((item) => (
                            <CarouselItem key={item.productId} className="basis-[220px] pl-3">
                                <article
                                    className="flex h-[329px] flex-col justify-between items-start rounded-none border border-border bg-background"
                                    aria-label="Bonus bundle product card">
                                    {/* Image */}
                                    <div className="flex flex-col items-start self-stretch">
                                        <div className="px-4 py-3 self-stretch">
                                            <div className="bg-muted/30 border border-border rounded-none overflow-hidden">
                                                <div className="h-36 w-full relative">
                                                    {item.imageUrl ? (
                                                        <img
                                                            src={
                                                                toImageUrl({ src: item.imageUrl, config }) ??
                                                                item.imageUrl
                                                            }
                                                            alt={
                                                                item.imageAlt ||
                                                                item.productName ||
                                                                t('common:productImageAlt') ||
                                                                'Product Image'
                                                            }
                                                            loading="lazy"
                                                            className="absolute inset-0 h-full w-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                                            <span className="text-muted-foreground text-sm">
                                                                {t('common:noImageAvailable')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Product name and badge with price */}
                                        <div className="px-4 pb-2 flex items-start justify-between gap-1.5 self-stretch">
                                            <p className="text-sm font-semibold leading-tight text-card-foreground line-clamp-2">
                                                {item.productName}
                                            </p>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <Badge className="bg-primary text-primary-foreground font-semibold text-xs rounded-none">
                                                    {t('cart:bonusProducts.freeBadge')}
                                                </Badge>
                                                {(() => {
                                                    const { currentPrice } = getPriceData(item.product);
                                                    return currentPrice > 0 ? (
                                                        <span className="text-sm text-muted-foreground line-through">
                                                            {formatCurrency(currentPrice, i18n.language, currency)}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Select button */}
                                    <div className="px-4 pb-3 self-stretch">
                                        <Button
                                            className="w-full h-9"
                                            onClick={() =>
                                                handleSelectProduct(item.productId, item.productName, item.product)
                                            }
                                            disabled={
                                                addToCartFetcher.state === 'submitting' ||
                                                selectedBonusItems >= maxBonusItems
                                            }>
                                            {addToCartFetcher.state === 'submitting' ? 'Adding...' : 'Select'}
                                        </Button>
                                    </div>
                                </article>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 size-8 rounded-full border border-border" />
                    <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 size-8 rounded-full border border-border" />
                </div>
            </Carousel>
        </section>
    );
}
