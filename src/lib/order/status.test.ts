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
import { describe, test, expect } from 'vitest';
import { formatStatusFallbackLabel, getOrderStatusConfig, getShippingStatusConfig } from './status';

describe('order-status', () => {
    test('returns correct config for each SCAPI status', () => {
        expect(getOrderStatusConfig('created')?.labelKey).toBe('orders.status.created');

        expect(getOrderStatusConfig('new')?.labelKey).toBe('orders.status.new');

        expect(getOrderStatusConfig('completed')?.labelKey).toBe('orders.status.completed');

        expect(getOrderStatusConfig('cancelled')?.labelKey).toBe('orders.status.cancelled');

        expect(getOrderStatusConfig('replaced')?.labelKey).toBe('orders.status.replaced');

        expect(getOrderStatusConfig('failed')?.labelKey).toBe('orders.status.failed');
    });

    test('normalizes status (lowercase, spaces to underscores)', () => {
        expect(getOrderStatusConfig('COMPLETED')?.labelKey).toBe('orders.status.completed');
        expect(getOrderStatusConfig('REPLACED')?.labelKey).toBe('orders.status.replaced');
    });

    test('returns undefined for non-SCAPI order status strings', () => {
        expect(getOrderStatusConfig('unknown_status')).toBeUndefined();
    });

    test('returns undefined for missing or empty status', () => {
        expect(getOrderStatusConfig(undefined)).toBeUndefined();
        expect(getOrderStatusConfig('')).toBeUndefined();
        expect(getOrderStatusConfig('   ')).toBeUndefined();
    });

    test('assigns icons to appropriate statuses', () => {
        expect(getOrderStatusConfig('completed')?.icon).toBe('check');
        expect(getOrderStatusConfig('cancelled')?.icon).toBe('x');
        expect(getOrderStatusConfig('replaced')?.icon).toBe('check');
        expect(getOrderStatusConfig('failed')?.icon).toBe('x');
        expect(getOrderStatusConfig('created')?.icon).toBeUndefined();
        expect(getOrderStatusConfig('new')?.icon).toBeUndefined();
    });

    test('formats fallback labels consistently', () => {
        expect(formatStatusFallbackLabel('SHIPPED')).toBe('Shipped');
        expect(formatStatusFallbackLabel('not_shipped')).toBe('Not Shipped');
        expect(formatStatusFallbackLabel('Failed')).toBe('Failed');
        expect(formatStatusFallbackLabel('  in_progress  ')).toBe('In Progress');
        expect(formatStatusFallbackLabel('')).toBe('');
        expect(formatStatusFallbackLabel('   ')).toBe('');
        expect(formatStatusFallbackLabel(undefined)).toBe('');
    });

    describe('shipping status', () => {
        test('returns correct config for each shipping status', () => {
            expect(getShippingStatusConfig('not_shipped')?.labelKey).toBe('orders.shippingStatus.notShipped');
            expect(getShippingStatusConfig('part_shipped')?.labelKey).toBe('orders.shippingStatus.partShipped');
            expect(getShippingStatusConfig('shipped')?.labelKey).toBe('orders.shippingStatus.shipped');
        });

        test('normalizes status (lowercase, spaces to underscores)', () => {
            expect(getShippingStatusConfig('SHIPPED')?.labelKey).toBe('orders.shippingStatus.shipped');
            expect(getShippingStatusConfig('Part Shipped')?.labelKey).toBe('orders.shippingStatus.partShipped');
        });

        test('returns undefined for unknown or empty status', () => {
            expect(getShippingStatusConfig('unknown')).toBeUndefined();
            expect(getShippingStatusConfig(undefined)).toBeUndefined();
            expect(getShippingStatusConfig('')).toBeUndefined();
            expect(getShippingStatusConfig('   ')).toBeUndefined();
        });
    });
});
