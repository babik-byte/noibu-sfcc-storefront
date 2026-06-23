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
import { Children, type ReactElement, type ReactNode } from 'react';
import { DEV_COLORS as C } from '@/lib/ui-target-dev-mode/dev-colors';

// Computed once at module load time — URL params don't change during a page session
const IS_SMOKE_TEST_ENABLED =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('uiTargetSmoke') === '1';

/**
 * Generic smoke test marker that can be used for ANY UITarget.
 * Shows the targetId and whether it's a wrapper or replacement target.
 * Only appears when ?uiTargetSmoke=1 is in the URL.
 */
export default function GenericSmokeMarker({
    targetId,
    hint,
    children,
}: {
    targetId?: string;
    hint?: string;
    children?: ReactNode;
}): ReactElement | null {
    if (!IS_SMOKE_TEST_ENABLED) {
        return <>{children}</>;
    }

    const hasChildren = Children.count(children) > 0;
    const targetType = hasChildren ? 'wrapper' : 'replacement';

    return (
        <div
            className="my-2 rounded-none px-3 py-2"
            data-ui-target-hint={hint}
            style={{
                fontFamily: 'monospace',
                border: `2px solid ${C.red500}`,
                background: C.redBg,
            }}>
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: C.red700 }}>
                <span>🎯</span>
                <span>TARGET: {targetId || 'unknown'}</span>
                <span
                    className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                        background: hasChildren ? C.wrapBg : C.insBg,
                        color: hasChildren ? C.wrapText : C.insText,
                    }}>
                    [{targetType}]
                </span>
                {hint && (
                    <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: C.gray100, color: C.gray600 }}>
                        {hint}
                    </span>
                )}
            </div>

            {/* For wrapper targets, show the wrapped children */}
            {hasChildren && (
                <div className="mt-2 pl-3 text-xs" style={{ borderLeft: `2px solid ${C.redBorder}`, color: C.gray500 }}>
                    <div className="mb-1 text-[10px] font-semibold" style={{ color: C.gray500 }}>
                        ↓ Wrapped content:
                    </div>
                    {children}
                </div>
            )}
        </div>
    );
}
