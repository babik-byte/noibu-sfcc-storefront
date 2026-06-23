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
 * DEV-ONLY CONSTANTS
 * Shared color palette for UITarget dev mode components.
 * Intentionally not themeable — these are debugging overlays, not production UI.
 */

export const DEV_COLORS = {
    // Purple — primary UITarget dev mode color
    accent: '#7c3aed',
    accentLight: '#ede9fe',
    accentHover: '#ddd6fe',
    accentDark: '#4c1d95',
    accentBorder: '#c4b5fd',

    // Neutral
    white: '#ffffff',
    whiteBg: 'rgba(255,255,255,0.65)',
    gray100: '#f4f4f5',
    gray400: '#a1a1aa',
    gray500: '#71717a',
    gray600: '#52525b',
    gray800: '#27272a',

    // Blue — wrapper target type badge
    wrapBg: '#bfdbfe',
    wrapText: '#1e40af',

    // Green — insertion target type badge
    insBg: '#bbf7d0',
    insText: '#166534',

    // Red — smoke test markers
    red500: '#ef4444',
    redBg: 'rgba(239,68,68,0.06)',
    redBorder: 'rgba(239,68,68,0.3)',
    red700: '#b91c1c',
} as const;
