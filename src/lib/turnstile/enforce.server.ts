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

import type { AppConfig } from '@/types/config';
import { verifyTurnstileToken } from '@/lib/turnstile/verify.server';
import { getTurnstileSecretKey, getTurnstileSiteKey } from '@/lib/turnstile/utils';
import { getSiteverifyMetricsSnapshot, isTurnstileDegraded } from '@/lib/turnstile/health.server';
import { redactEmailForLog } from '@/lib/turnstile/log-redact.server';

const INFRASTRUCTURE_ERROR_CODES = new Set(['internal-error']);
// Only HTTP 5xx from siteverify is a CF-side failure. 4xx codes (400/401/403/etc.) mean
// our request was malformed (bad secret, wrong content-type) — fail-closed so a
// misconfiguration cannot silently bypass verification.
const HTTP_INFRASTRUCTURE_ERROR_PATTERN = /^http-error-5\d{2}$/;

interface TurnstileEnforceLogger {
    warn(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
}

interface EnforceTurnstileOptions {
    request: Request;
    config: AppConfig;
    turnstileToken: string | undefined;
    logger: TurnstileEnforceLogger;
    actionName: string;
    email?: string;
}

/**
 * Enforces Turnstile verification when enabled in config.
 *
 * Returns `true` if the request may proceed — either because verification is
 * disabled or because the token passed Cloudflare's siteverify check.
 *
 * Returns `false` if the request must be blocked (missing token, failed
 * verification, origin mismatch, etc.). The reason is logged at `warn` level
 * with the supplied `actionName` for traceability.
 */
export async function enforceTurnstile({
    request,
    config,
    turnstileToken,
    logger,
    actionName,
    email,
}: EnforceTurnstileOptions): Promise<boolean> {
    const verificationEnabled = config.security?.turnstile?.verification?.enabled ?? false;
    if (!verificationEnabled || !config.security?.turnstile?.enabled) {
        return true;
    }

    // Email redaction: at scale (fail-open during a CF outage) raw emails accumulate as
    // PII in MRT logs. Redacted form keeps the domain visible (forensics signal — many
    // domains vs. single domain) and replaces the local-part with a stable hash so the
    // same shopper still correlates across log lines.
    const redactedEmail = redactEmailForLog(email);

    const requestUrl = request.headers.get('origin') || request.headers.get('referer') || '';

    if (!requestUrl) {
        logger.warn(
            '[Turnstile] No Origin or Referer header — cannot determine site key. Check reverse-proxy config.',
            {
                action: actionName,
                email: redactedEmail,
            }
        );
        return false;
    }

    const siteKey = getTurnstileSiteKey(config, requestUrl);
    const secretKey = siteKey ? getTurnstileSecretKey(siteKey) : null;
    const remoteIp =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('cf-connecting-ip') ||
        undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    if (!siteKey) {
        logger.warn('[Turnstile] No site key match for request origin — blocked', {
            requestUrl,
            remoteIp,
            userAgent,
            email: redactedEmail,
            action: actionName,
        });
        return false;
    }

    if (!secretKey) {
        logger.warn('[Turnstile] No secret key configured for site — blocked', {
            siteKey,
            requestUrl,
            action: actionName,
        });
        return false;
    }

    if (!turnstileToken) {
        const degraded = await isTurnstileDegraded();
        if (degraded) {
            logger.warn('[Turnstile] Missing token — allowed (Turnstile platform degraded)', {
                email: redactedEmail,
                remoteIp,
                userAgent,
                action: actionName,
                metrics: getSiteverifyMetricsSnapshot(),
            });
            return true;
        }
        logger.warn('[Turnstile] Missing token — blocked request without challenge completion', {
            email: redactedEmail,
            remoteIp,
            userAgent,
            action: actionName,
        });
        return false;
    }

    const verification = await verifyTurnstileToken({
        token: turnstileToken,
        secretKey,
        remoteIp,
    });

    if (!verification.success) {
        const isInfrastructureError = verification.errorCodes.some(
            (code) => INFRASTRUCTURE_ERROR_CODES.has(code) || HTTP_INFRASTRUCTURE_ERROR_PATTERN.test(code)
        );

        if (isInfrastructureError) {
            logger.warn('[Turnstile] Verification failed due to infrastructure issue — allowed (fail-open)', {
                errorCodes: verification.errorCodes,
                email: redactedEmail,
                remoteIp,
                userAgent,
                action: actionName,
                metrics: getSiteverifyMetricsSnapshot(),
            });
            return true;
        }

        logger.warn('[Turnstile] Verification failed — potential bot or replay attack', {
            errorCodes: verification.errorCodes,
            email: redactedEmail,
            remoteIp,
            userAgent,
            action: actionName,
            hasToken: !!turnstileToken,
        });
        return false;
    }

    logger.debug('[Turnstile] Verification passed', {
        challengeTs: verification.challengeTs,
        action: actionName,
    });

    return true;
}
