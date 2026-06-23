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
import { encodeBase64Url } from '@/lib/url';

/** Base path of the SCAPI resource client route. Shared by `useScapiFetcher`, `useScapiFetchClient`, and `useScapiFetchHelper`. */
export const RESOURCE_API_ROUTE = '/resource/api/client';

/**
 * Encode a SCAPI resource tuple as a base64-url string for the
 * `/resource/api/client/$resource` route. Shared by `useScapiFetcher`,
 * `useScapiFetchClient`, and `useScapiFetchHelper`.
 *
 * Two shapes are supported:
 *
 *   1. Regular SCAPI client + method + options
 *      `encodeResource('shopperProducts', 'getProduct', { params: ... })`
 *      → encoded tuple `['shopperProducts', 'getProduct', { params: ... }]`
 *
 *   2. Helper namespace + helper method + options (with `helperName`)
 *      `encodeResource('helpers', 'basket', { helperName: 'getOrCreateBasket', ... })`
 *      → encoded tuple `['helpers', 'basket', { helperName: 'getOrCreateBasket', ... }]`
 *
 * The route's `loader`/`action` accept either tuple shape.
 */
export function encodeResource(client: string, method: string, options: unknown): string {
    return encodeBase64Url(JSON.stringify([client, method, options]));
}
