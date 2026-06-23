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
import { describe, test, expect, vi } from 'vitest';
import { action } from './action.set-site-context';
import type { ActionFunctionArgs } from 'react-router';
import { createFormDataRequest } from '@/test-utils/request-helpers';
import { mockAltSiteObject, mockConfig, mockSiteObject } from '@/test-utils/config';

const mockSiteCookieSerialize = vi.fn((value: string) => Promise.resolve(`site_id=${value}; Path=/`));
const mockLocaleCookieSerialize = vi.fn((value: string) => Promise.resolve(`lng=${value}; Path=/`));
const mockCurrencyCookieSerialize = vi.fn((value: string) => Promise.resolve(`currency=${value}; Path=/`));

vi.mock('@salesforce/storefront-next-runtime/site-context', () => ({
    getSiteContextCookies: vi.fn(() => ({
        siteCookie: { serialize: mockSiteCookieSerialize },
        localeCookie: { serialize: mockLocaleCookieSerialize },
        currencyCookie: { serialize: mockCurrencyCookieSerialize },
    })),
    siteContext: Symbol('siteContext'),
}));

const defaultSite = mockSiteObject;
const mockSiteContext = {
    site: defaultSite,
};

vi.mock('@salesforce/storefront-next-runtime/config', () => ({
    getConfig: vi.fn(() => mockConfig),
}));

vi.mock('@/lib/logger.server', () => ({
    getLogger: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    })),
}));

function createContext() {
    return {
        get: vi.fn(() => mockSiteContext),
    } as any;
}

function createArgs(type: string, payload: Record<string, string> = {}): ActionFunctionArgs {
    return {
        request: createFormDataRequest('http://localhost/action/set-site-context', 'POST', {
            type,
            payload: JSON.stringify(payload),
        }),
        params: {},
        context: createContext(),
        unstable_pattern: 'action/set-site-context',
    };
}

describe('action.set-site-context', () => {
    describe('type: site', () => {
        test('sets site, locale, and currency cookies and redirects to /', async () => {
            const result = (await action(createArgs('site', { siteId: mockAltSiteObject.id }))) as Response;

            expect(result.status).toBe(302);
            expect(result.headers.get('Location')).toBe('/');
            expect(mockSiteCookieSerialize).toHaveBeenCalledWith(mockAltSiteObject.id);
            expect(mockLocaleCookieSerialize).toHaveBeenCalledWith('en-US');
            expect(mockCurrencyCookieSerialize).toHaveBeenCalledWith('USD');
        });

        test('rejects when siteId is missing', async () => {
            try {
                await action(createArgs('site'));
                expect.fail('Expected action to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(Response);
                expect((error as Response).status).toBe(400);
                expect(await (error as Response).text()).toBe('siteId is required');
            }
        });

        test('rejects when site is not found', async () => {
            try {
                await action(createArgs('site', { siteId: 'nonexistent' }));
                expect.fail('Expected action to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(Response);
                expect((error as Response).status).toBe(400);
                expect(await (error as Response).text()).toContain('not found');
            }
        });
    });

    describe('type: locale', () => {
        test('sets locale cookie and redirects to pathname', async () => {
            const result = (await action(
                createArgs('locale', { locale: 'it-IT', pathname: '/global/it-IT/products' })
            )) as Response;

            expect(result.status).toBe(302);
            expect(result.headers.get('Location')).toBe('/global/it-IT/products');
            expect(result.headers.get('Set-Cookie')).toContain('lng=');
        });

        test('redirects to / when pathname is not provided', async () => {
            const result = (await action(createArgs('locale', { locale: 'en-GB' }))) as Response;

            expect(result.status).toBe(302);
            expect(result.headers.get('Location')).toBe('/');
        });

        test('rejects when locale is missing', async () => {
            try {
                await action(createArgs('locale'));
                expect.fail('Expected action to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(Response);
                expect((error as Response).status).toBe(400);
                expect(await (error as Response).text()).toBe('Locale is required');
            }
        });

        test('rejects unsupported locale', async () => {
            try {
                await action(createArgs('locale', { locale: 'fr-FR' }));
                expect.fail('Expected action to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(Response);
                expect((error as Response).status).toBe(400);
                expect(await (error as Response).text()).toContain('not supported');
            }
        });

        test('redirects to / when pathname is not a relative path', async () => {
            const result = (await action(
                createArgs('locale', { locale: 'en-GB', pathname: 'https://evil.com/phish' })
            )) as Response;

            expect(result.status).toBe(302);
            expect(result.headers.get('Location')).toBe('/');
        });
    });

    describe('type: currency', () => {
        test('sets currency cookie and returns success', async () => {
            const result = (await action(createArgs('currency', { currency: 'GBP' }))) as {
                type: string;
                data: { success: boolean };
                init: { headers: { 'Set-Cookie': string } };
            };

            expect(result.data).toEqual({ success: true });
            expect(result.init.headers['Set-Cookie']).toContain('currency=');
            expect(mockCurrencyCookieSerialize).toHaveBeenCalledWith('GBP');
        });

        test('rejects when currency is missing', async () => {
            try {
                await action(createArgs('currency'));
                expect.fail('Expected action to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(Response);
                expect((error as Response).status).toBe(400);
                expect(await (error as Response).text()).toBe('Currency is required');
            }
        });

        test('rejects unsupported currency', async () => {
            try {
                await action(createArgs('currency', { currency: 'JPY' }));
                expect.fail('Expected action to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(Response);
                expect((error as Response).status).toBe(400);
                expect(await (error as Response).text()).toContain('not supported');
            }
        });
    });

    describe('unknown type', () => {
        test('rejects unknown type', async () => {
            try {
                await action(createArgs('unknown'));
                expect.fail('Expected action to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(Response);
                expect((error as Response).status).toBe(400);
                expect(await (error as Response).text()).toContain('Unknown site context action type');
            }
        });

        test('rejects when type is missing', async () => {
            try {
                await action(createArgs(''));
                expect.fail('Expected action to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(Response);
                expect((error as Response).status).toBe(400);
            }
        });
    });
});
