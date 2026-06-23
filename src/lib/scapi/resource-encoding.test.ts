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
import { describe, expect, test } from 'vitest';
import { decodeBase64Url } from '@/lib/url';
import { encodeResource } from './resource-encoding';

describe('encodeResource', () => {
    test('encodes a regular SCAPI client+method+options tuple', () => {
        const encoded = encodeResource('shopperProducts', 'getProduct', {
            params: { path: { id: 'apple-ipod' } },
        });
        const decoded = JSON.parse(decodeBase64Url(encoded));
        expect(decoded).toEqual(['shopperProducts', 'getProduct', { params: { path: { id: 'apple-ipod' } } }]);
    });

    test('encodes a helper namespace tuple with helperName injected into options', () => {
        const encoded = encodeResource('helpers', 'basket', {
            helperName: 'getOrCreateBasket',
            currency: 'USD',
        });
        const decoded = JSON.parse(decodeBase64Url(encoded));
        expect(decoded).toEqual(['helpers', 'basket', { helperName: 'getOrCreateBasket', currency: 'USD' }]);
    });

    test('produces stable output for structurally identical options', () => {
        const a = encodeResource('shopperProducts', 'getProduct', {
            params: { path: { id: 'x' } },
        });
        const b = encodeResource('shopperProducts', 'getProduct', {
            params: { path: { id: 'x' } },
        });
        expect(a).toBe(b);
    });
});
