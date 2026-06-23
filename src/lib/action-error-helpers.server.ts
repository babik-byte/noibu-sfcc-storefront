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
import { ErrorCode, type ActionError } from '@/lib/error-codes';
import { ApiError } from '@/scapi';
import { getErrorMessage } from '@/lib/utils';

export type { ActionError } from '@/lib/error-codes';

export function createActionError(args: { code: string; message: string }): ActionError;
export function createActionError(args: { error: unknown; code?: string }): ActionError;
export function createActionError(args: { code?: string; message?: string; error?: unknown }): ActionError {
    if (args.message !== undefined && args.code !== undefined) {
        return { code: args.code, message: args.message };
    }

    const error = args.error;
    const fallbackCode = args.code ?? ErrorCode.OPERATION_FAILED;

    if (error instanceof ApiError) {
        const message = error.body?.detail || error.statusText || getErrorMessage(error);
        const code = mapStatusCode(error.status) ?? fallbackCode;
        return { code, message };
    }

    return {
        code: fallbackCode,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
}

function mapStatusCode(status: number): string | undefined {
    switch (status) {
        case 401:
            return ErrorCode.NOT_AUTHENTICATED;
        case 403:
            return ErrorCode.NOT_AUTHORIZED;
        case 404:
            return ErrorCode.NOT_FOUND;
        case 409:
            return ErrorCode.CONFLICT;
        case 429:
            return ErrorCode.RATE_LIMITED;
        default:
            return undefined;
    }
}
