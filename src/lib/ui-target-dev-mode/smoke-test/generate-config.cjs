#!/usr/bin/env node

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
 * Additively syncs target-config.json with UITarget usages in the codebase.
 *
 * Rules:
 *   - NEW targets (not yet in config) → added with hint derived from the targetId's page area
 *   - EXISTING targets               → hint and all fields preserved exactly as-is
 *   - REMOVED targets (gone from src) → pruned from config
 *
 * Hint derivation: targetIds follow a `<area>.<feature>.<slot>` convention (e.g.
 * `pdp.reviews.list`, `cart.shipping.deliveryEstimate`). The hint is the first
 * dotted segment, except for `sfcc.<area>.…` targets where it's the second
 * segment, since `sfcc` is a vendor-namespace prefix rather than a page area.
 *
 * This means target-config.json only diffs when UITargets are actually added or removed.
 * Hints are set once at creation time and never overwritten automatically.
 *
 * Run via: pnpm smoke-test:generate
 */

const fs = require('fs');
const path = require('path');

const searchPath = path.join(__dirname, '../../../../src');
const outputDir = path.join(__dirname, '../../../extensions/ui-target-smoke-test');
const configPath = path.join(outputDir, 'target-config.json');

// Matches targetId="some.target.id" in .ts/.tsx files
const TARGET_ID_PATTERN = /targetId="([^"]+)"/g;

// Directories that contain dev tooling rather than real UITarget usages
const EXCLUDED_DIRS = new Set(['ui-target-dev-mode', 'ui-target-smoke-test']);

const SMOKE_TEST_PATH = 'extensions/ui-target-smoke-test/components/generic-marker.tsx';

/**
 * Derive a page-area label from a targetId for use as a hint in the dev overlay.
 * The dev overlay groups targets by hint, so it should reflect the surface the
 * target lives on, not branch or PR metadata.
 */
function deriveHint(targetId) {
    const parts = targetId.split('.');
    if (parts[0] === 'sfcc' && parts.length > 1) {
        return parts[1];
    }
    return parts[0];
}

/**
 * Recursively collect all UITarget IDs in source files.
 * Returns a Set<targetId>.
 */
function collectTargetIds(dir, result = new Set()) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!EXCLUDED_DIRS.has(entry.name)) {
                collectTargetIds(fullPath, result);
            }
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            TARGET_ID_PATTERN.lastIndex = 0;
            let match;
            while ((match = TARGET_ID_PATTERN.exec(content)) !== null) {
                result.add(match[1]);
            }
        }
    }
    return result;
}

/**
 * Load existing entries from target-config.json.
 * Returns a Map<targetId, entry> preserving all fields.
 */
function loadExisting() {
    try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return new Map((raw.components || []).map((c) => [c.targetId, c]));
    } catch {
        return new Map();
    }
}

try {
    console.log('🔍 Scanning codebase for UITarget usages...');

    const foundIds = collectTargetIds(searchPath);
    const existing = loadExisting();

    const added = [];
    const removed = [];

    // Build updated config: preserve existing, add new, drop removed
    const components = [...foundIds]
        .sort()
        .map((targetId) => {
            if (existing.has(targetId)) {
                return existing.get(targetId);
            }
            added.push(targetId);
            return {
                targetId,
                path: SMOKE_TEST_PATH,
                hint: deriveHint(targetId),
                order: 999,
            };
        });

    for (const [targetId] of existing) {
        if (!foundIds.has(targetId)) {
            removed.push(targetId);
        }
    }

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ components }, null, 4) + '\n');

    console.log(`✅ Synced target-config.json (${components.length} total entries)`);
    if (added.length) {
        console.log(`   ➕ Added ${added.length} new targets:`);
        added.forEach((id) => console.log(`      • ${id} (hint: "${deriveHint(id)}")`));
    }
    if (removed.length) {
        console.log(`   ➖ Removed ${removed.length} stale targets:`);
        removed.forEach((id) => console.log(`      • ${id}`));
    }
    if (!added.length && !removed.length) {
        console.log('   ✨ No changes — config is already up to date');
    }
    console.log(`📝 Config written to: ${configPath}`);
    console.log('\n🎯 Usage: Add ?uiTargetSmoke=1 to any URL to see all targets');
} catch (error) {
    console.error('❌ Error generating config:', error.message);
    process.exit(1);
}
