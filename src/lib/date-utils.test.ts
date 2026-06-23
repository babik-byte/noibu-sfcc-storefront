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
import { describe, expect, it } from 'vitest';
import { formatDateForLocale } from './date-utils';

describe('formatDateForLocale', () => {
    describe('valid dates', () => {
        it('should format date for en-GB locale (MM/DD/YYYY)', () => {
            const result = formatDateForLocale('1990-05-15', 'en-US');
            expect(result).toBe('05/15/1990');
        });

        it('should format date for it-IT locale (DD/MM/YYYY)', () => {
            const result = formatDateForLocale('1990-05-15', 'it-IT');
            expect(result).toBe('15/05/1990');
        });

        it('should format date for de-DE locale (DD.MM.YYYY)', () => {
            const result = formatDateForLocale('1990-05-15', 'de-DE');
            expect(result).toBe('15.05.1990');
        });

        it('should handle single digit months and days', () => {
            const result = formatDateForLocale('2000-01-05', 'en-US');
            expect(result).toBe('01/05/2000');
        });

        it('should handle dates at end of year', () => {
            const result = formatDateForLocale('1999-12-31', 'en-US');
            expect(result).toBe('12/31/1999');
        });
    });

    describe('invalid inputs', () => {
        it('should return undefined for undefined input', () => {
            const result = formatDateForLocale(undefined, 'en-US');
            expect(result).toBeUndefined();
        });

        it('should return undefined for empty string', () => {
            const result = formatDateForLocale('', 'en-US');
            expect(result).toBeUndefined();
        });

        it('should return undefined for invalid date string', () => {
            const result = formatDateForLocale('invalid-date', 'en-US');
            expect(result).toBeUndefined();
        });

        it('should return undefined for malformed date', () => {
            const result = formatDateForLocale('not-a-date', 'en-US');
            expect(result).toBeUndefined();
        });
    });

    describe('edge cases', () => {
        it('should handle leap year date', () => {
            const result = formatDateForLocale('2000-02-29', 'en-US');
            expect(result).toBe('02/29/2000');
        });

        it('should handle date with different locale formats', () => {
            const date = '2023-07-04';
            const usResult = formatDateForLocale(date, 'en-US');
            const ukResult = formatDateForLocale(date, 'en-GB');

            // US format: MM/DD/YYYY
            expect(usResult).toBe('07/04/2023');
            // UK format: DD/MM/YYYY
            expect(ukResult).toBe('04/07/2023');
        });
    });
});
