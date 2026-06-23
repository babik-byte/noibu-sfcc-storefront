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
 * Floating control panel for UITarget dev mode.
 * Lazy-loaded only when VITE_UI_TARGET_DEV_MODE=true.
 */

import { useState, useEffect, useCallback } from 'react';
import { DEV_COLORS as C } from './dev-colors';

// w-56 = 224px. Subtract half the panel width from the initial x so the panel is visually
// centered on first render without transform: translateX(-50%), which causes a jump when dragging starts.
const PANEL_WIDTH = 224;
const PANEL_HALF_WIDTH = PANEL_WIDTH / 2;
const HINT_FILTER_STYLE_ID = 'ui-target-hint-filter';

function getInitialX() {
    return typeof window !== 'undefined' ? window.innerWidth / 2 - PANEL_HALF_WIDTH : 400;
}

/** Inject (or remove) a <style> tag that hides badges for non-matching hint values. */
function applyHintFilter(activeHint: string | null) {
    let style = document.getElementById(HINT_FILTER_STYLE_ID) as HTMLStyleElement | null;

    if (activeHint === null) {
        style?.remove();
        return;
    }

    if (!style) {
        style = document.createElement('style');
        style.id = HINT_FILTER_STYLE_ID;
        document.head.appendChild(style);
    }

    // Hide badge (and dashed outline) for non-matching markers; keep children rendered so page layout is preserved.
    style.textContent = `
        [data-ui-target-hint]:not([data-ui-target-hint="${activeHint}"]) [data-ui-target-badge] {
            display: none !important;
        }
        [data-ui-target-hint]:not([data-ui-target-hint="${activeHint}"]) > div:last-child {
            outline: none !important;
        }
    `;
}

/** Collect unique hint values from all marker elements currently in the DOM. */
function collectHints(): string[] {
    const hints = new Set<string>();
    document.querySelectorAll('[data-ui-target-hint]').forEach((el) => {
        const h = el.getAttribute('data-ui-target-hint');
        if (h) hints.add(h);
    });
    return [...hints].sort();
}

/**
 * Draggable floating panel showing UITarget count and hint-based filter buttons.
 */
export function UITargetDevOverlay() {
    const [collapsed, setCollapsed] = useState(false);
    const [total, setTotal] = useState(0);
    const [visibleCount, setVisibleCount] = useState(0);
    const [hints, setHints] = useState<string[]>([]);
    const [activeHint, setActiveHint] = useState<string | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState(() => ({ x: getInitialX(), y: 20 }));
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Count markers and collect hints via MutationObserver
    useEffect(() => {
        const refresh = () => {
            const allTotal = document.querySelectorAll('[data-ui-target-dev-id]').length;
            const newHints = collectHints();
            setTotal(allTotal);
            setHints(newHints);
            // Recompute visible count here so it's always in sync with the active filter
            setActiveHint((current) => {
                setVisibleCount(
                    current === null ? allTotal : document.querySelectorAll(`[data-ui-target-hint="${current}"]`).length
                );
                return current;
            });
        };

        refresh();

        const observer = new MutationObserver(refresh);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-ui-target-hint', 'data-ui-target-dev-id'],
        });

        return () => {
            observer.disconnect();
            document.getElementById(HINT_FILTER_STYLE_ID)?.remove();
        };
    }, []);

    const handleFilterClick = useCallback(
        (hint: string | null) => {
            const next = hint === activeHint ? null : hint;
            setActiveHint(next);
            setVisibleCount(
                next === null ? total : document.querySelectorAll(`[data-ui-target-hint="${next}"]`).length
            );
            applyHintFilter(next);
            document.dispatchEvent(new CustomEvent('uitarget:collapse-all'));
        },
        [activeHint, total]
    );

    // Handle dragging
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        };
        const handleMouseUp = () => setIsDragging(false);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    return (
        <div
            className="fixed z-[99999] w-56 rounded-none shadow-2xl backdrop-blur-sm"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                border: `2px solid ${C.accent}`,
                background: C.whiteBg,
            }}>
            {/* Header - draggable */}
            <div
                className="flex cursor-move items-center justify-between rounded-none px-3 py-2"
                style={{ background: C.accent, color: C.white }}
                onMouseDown={handleMouseDown}>
                <span className="text-sm font-semibold">🎯 UITarget Dev Mode</span>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    aria-label={collapsed ? 'Expand' : 'Collapse'}
                    style={{ color: C.white, opacity: 0.85 }}>
                    {collapsed ? '▼' : '▲'}
                </button>
            </div>

            {!collapsed && (
                <>
                    {/* Count row */}
                    <div className="flex justify-between px-3 py-2 text-xs" style={{ color: C.gray500 }}>
                        <span>UITargets on page:</span>
                        <span className="font-semibold" style={{ color: C.accentDark }}>
                            {activeHint === null ? total : `${visibleCount} / ${total}`}
                        </span>
                    </div>

                    {/* Hint filter buttons — only rendered when hints are present */}
                    {hints.length > 0 && (
                        <div className="space-y-1 border-t px-3 pb-2 pt-2" style={{ borderColor: C.accentBorder }}>
                            <p
                                className="mb-1 text-[10px] font-semibold uppercase tracking-wide"
                                style={{ color: C.gray500 }}>
                                Filter
                            </p>
                            {/* Show All button */}
                            <button
                                onClick={() => handleFilterClick(null)}
                                className="w-full rounded px-2 py-1 text-left text-xs transition-colors"
                                style={{
                                    background: activeHint === null ? C.accent : C.accentLight,
                                    color: activeHint === null ? C.white : C.accentDark,
                                    border: `1px solid ${C.accentBorder}`,
                                }}>
                                Show All
                            </button>
                            {/* One button per unique hint */}
                            {hints.map((hint) => (
                                <button
                                    key={hint}
                                    onClick={() => handleFilterClick(hint)}
                                    className="w-full rounded px-2 py-1 text-left text-xs transition-colors"
                                    style={{
                                        background: activeHint === hint ? C.accent : C.accentLight,
                                        color: activeHint === hint ? C.white : C.accentDark,
                                        border: `1px solid ${C.accentBorder}`,
                                    }}>
                                    {hint}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
