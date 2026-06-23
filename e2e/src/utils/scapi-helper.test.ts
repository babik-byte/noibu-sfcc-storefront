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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getScapiConfig } from './scapi-helper';

const SCAPI_KEYS = [
    'PUBLIC__app__commerce__api__clientId',
    'PUBLIC__app__commerce__api__organizationId',
    'PUBLIC__app__commerce__api__shortCode',
    'COMMERCE_API_SLAS_SECRET',
    'SITE_ID',
] as const;

describe('getScapiConfig', () => {
    let saved: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of SCAPI_KEYS) saved[key] = process.env[key];
    });

    afterEach(() => {
        for (const key of SCAPI_KEYS) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
        saved = {};
    });

    it('returns null when SITE_ID is missing (test-runner concern, never read from app .env)', () => {
        process.env.PUBLIC__app__commerce__api__clientId = 'cid';
        process.env.PUBLIC__app__commerce__api__organizationId = 'oid';
        process.env.PUBLIC__app__commerce__api__shortCode = 'short';
        delete process.env.SITE_ID;

        expect(getScapiConfig()).toBeNull();
    });

    it('reads SCAPI vars from process.env when present (CI path)', () => {
        process.env.PUBLIC__app__commerce__api__clientId = 'env-cid';
        process.env.PUBLIC__app__commerce__api__organizationId = 'env-oid';
        process.env.PUBLIC__app__commerce__api__shortCode = 'env-short';
        process.env.COMMERCE_API_SLAS_SECRET = 'env-secret';
        process.env.SITE_ID = 'RefArchGlobal';

        expect(getScapiConfig()).toEqual({
            clientId: 'env-cid',
            organizationId: 'env-oid',
            shortCode: 'env-short',
            siteId: 'RefArchGlobal',
            slasSecret: 'env-secret',
        });
    });

    it('omits slasSecret when not set (still returns valid config)', () => {
        process.env.PUBLIC__app__commerce__api__clientId = 'cid';
        process.env.PUBLIC__app__commerce__api__organizationId = 'oid';
        process.env.PUBLIC__app__commerce__api__shortCode = 'short';
        process.env.SITE_ID = 'Site';
        delete process.env.COMMERCE_API_SLAS_SECRET;

        const config = getScapiConfig();
        expect(config).not.toBeNull();
        expect(config?.slasSecret).toBeUndefined();
    });
});
