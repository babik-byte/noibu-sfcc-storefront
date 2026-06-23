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

/**
 * DEV-ONLY COMPONENT
 * This component is ONLY imported in development builds via the Vite plugin.
 * It never exists in production (zero overhead).
 */

import { useState, useEffect, type ReactNode } from 'react';
import { createLogger } from '@/lib/logger';
import { DEV_COLORS as C } from './dev-colors';

const logger = createLogger();

interface UITargetDevMarkerProps {
    targetId: string;
    children?: ReactNode;
    __file__?: string;
    __hasChildren__?: boolean;
    __hint__?: string;
}

/**
 * Visual marker component that appears in development mode only.
 * Wraps each UITarget with a badge showing its ID and type.
 */
export function UITargetDevMarker({ targetId, children, __file__, __hasChildren__, __hint__ }: UITargetDevMarkerProps) {
    const [expanded, setExpanded] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [copied, setCopied] = useState(false);

    const hasChildren = __hasChildren__ ?? false;
    const shortFile = __file__?.split('/').slice(-2).join('/') ?? 'unknown';

    useEffect(() => {
        const collapse = () => setExpanded(false);
        document.addEventListener('uitarget:collapse-all', collapse);
        return () => document.removeEventListener('uitarget:collapse-all', collapse);
    }, []);

    const handleCopyId = () => {
        navigator.clipboard.writeText(targetId).then(
            () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            },
            () => {
                logger.warn(`Failed to copy UITarget "${targetId}" to clipboard`);
            }
        );
    };

    return (
        <div className="relative" data-ui-target-dev-id={targetId} data-ui-target-hint={__hint__}>
            {/* Badge in normal document flow — pushes content below it, simulating real extension layout */}
            <div
                data-ui-target-badge
                role="button"
                tabIndex={0}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono shadow-lg"
                style={{
                    cursor: 'pointer',
                    border: `2px solid ${C.accent}`,
                    background: hovered ? C.accentHover : C.accentLight,
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(!expanded);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }
                }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                title="Click for details">
                <span>🎯</span>
                <span className="font-semibold" style={{ color: C.accentDark }}>
                    {targetId}
                </span>
                <span
                    className="ml-1 rounded px-1 py-0.5 text-[8px] font-bold"
                    style={{
                        background: hasChildren ? C.wrapBg : C.insBg,
                        color: hasChildren ? C.wrapText : C.insText,
                    }}>
                    {hasChildren ? 'wrap' : 'ins'}
                </span>
            </div>

            {/* Expanded info panel — absolute so it overlays without disrupting flow */}
            {expanded && (
                <div
                    className="absolute left-0 top-7 z-[10000] w-80 rounded-none p-3 shadow-2xl"
                    style={{ border: `2px solid ${C.accent}`, background: C.white }}>
                    <div className="mb-2 flex items-start justify-between">
                        <h4 className="font-mono text-sm font-bold" style={{ color: C.accent }}>
                            {targetId}
                        </h4>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpanded(false);
                            }}
                            className="text-sm leading-none"
                            style={{ color: C.gray400 }}>
                            ×
                        </button>
                    </div>

                    <dl className="space-y-2 text-xs">
                        <div>
                            <dt className="font-semibold" style={{ color: C.gray600 }}>
                                Type:
                            </dt>
                            <dd style={{ color: C.gray800 }}>
                                {hasChildren ? (
                                    <>
                                        <span className="font-semibold">Wrapper</span> - Extension can enhance existing
                                        UI
                                    </>
                                ) : (
                                    <>
                                        <span className="font-semibold">Insertion</span> - Extension adds new UI
                                    </>
                                )}
                            </dd>
                        </div>

                        <div>
                            <dt className="font-semibold" style={{ color: C.gray600 }}>
                                File:
                            </dt>
                            <dd className="font-mono text-[10px]" style={{ color: C.gray800 }}>
                                {shortFile}
                            </dd>
                        </div>

                        <div>
                            <dt className="font-semibold" style={{ color: C.gray600 }}>
                                Usage:
                            </dt>
                            <dd
                                className="mt-1 rounded p-2 font-mono text-[10px]"
                                style={{ background: C.gray100, color: C.gray800 }}>
                                {hasChildren ? (
                                    <>
                                        &lt;UITarget targetId=&quot;{targetId}&quot;&gt;
                                        <br />
                                        &nbsp;&nbsp;&lt;YourComponent /&gt;
                                        <br />
                                        &lt;/UITarget&gt;
                                    </>
                                ) : (
                                    `<UITarget targetId="${targetId}" />`
                                )}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-3">
                        <button
                            onClick={handleCopyId}
                            className="rounded px-2 py-1 text-xs"
                            style={{ background: C.accent, color: C.white }}>
                            {copied ? '✓ Copied' : 'Copy ID'}
                        </button>
                    </div>
                </div>
            )}

            {/* Wrapped content with subtle outline to show scope */}
            <div style={hasChildren ? { outline: `1px dashed ${C.accentBorder}`, outlineOffset: '2px' } : undefined}>
                {children}
            </div>
        </div>
    );
}
