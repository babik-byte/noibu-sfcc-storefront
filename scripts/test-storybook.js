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
 * Unified Storybook test runner.
 *
 * Required:
 *   --type=snapshot|interaction|a11y
 *
 * Optional:
 *   --update     # snapshot only — regenerate snapshot fixtures
 *   --coverage   # snapshot only — auto-runs generate-story-tests then vitest --coverage
 *   --static     # interaction|a11y — build storybook & serve static instead of dev
 *
 * Snapshot tests use vitest. Interaction/a11y tests orchestrate a server
 * (storybook dev or `npx serve` of the static build) plus `test-storybook`,
 * with cleanup of the server process when done.
 */
import { spawn } from 'node:child_process';

// --- arg parsing -----------------------------------------------------------
const flags = {};
for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, value] = raw.slice(2).split('=');
    flags[key] = value === undefined ? true : value;
}

const type = flags.type;
if (!['snapshot', 'interaction', 'a11y'].includes(type)) {
    console.error('Error: --type=snapshot|interaction|a11y is required');
    process.exit(2);
}

// --- helpers ---------------------------------------------------------------
function run(cmd, args, env = process.env) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            env,
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });
        child.on('close', (code) => resolve(code ?? 0));
        child.on('error', reject);
    });
}

// --- snapshot --------------------------------------------------------------
if (type === 'snapshot') {
    const args = ['run'];
    if (flags.update) args.push('-u');
    if (flags.coverage) {
        const genCode = await run('node', ['scripts/generate-story-tests.js']);
        if (genCode !== 0) process.exit(genCode);
        args.push('--coverage');
    }
    args.push('--config', './.storybook/vite.config.ts');
    process.exit(await run('vitest', args));
}

// --- interaction | a11y ----------------------------------------------------
const isA11y = type === 'a11y';
const port = flags.static ? 3000 : 6006;
const url = `http://127.0.0.1:${port}`;

// a11y env vars apply only to runtime processes, NOT the static build:
// `.storybook/main.ts` inlines `process.env.STORYBOOK_A11Y_TEST_MODE` at build
// time via Vite `define`, so setting 'error' during the build would bake hard
// failures into the static bundle for every pre-existing violation. Original
// bash scripts only set these on the concurrently invocation that wraps the
// server + test-storybook — keep parity.
const testEnv = {
    ...process.env,
    ...(isA11y ? { STORYBOOK_A11Y_TEST_MODE: 'error' } : { STORYBOOK_DISABLE_A11Y: 'true' }),
};

if (flags.static) {
    const buildCode = await run('pnpm', ['storybook:build']);
    if (buildCode !== 0) process.exit(buildCode);
}

const serverCmd = flags.static
    ? { cmd: 'npx', args: ['serve', '.storybook/storybook-static', '-p', String(port)] }
    : { cmd: 'pnpm', args: ['storybook'] };

const server = spawn(serverCmd.cmd, serverCmd.args, {
    env: testEnv,
    stdio: 'pipe',
    shell: process.platform === 'win32',
});
// Drain output so the pipe buffer doesn't fill and block the child
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

const cleanup = () => {
    try {
        if (!server.killed) server.kill('SIGTERM');
    } catch {
        // already gone
    }
};
process.on('exit', cleanup);
process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
});

try {
    const waitCode = await run('npx', ['wait-on', url, '--timeout', '120000']);
    if (waitCode !== 0) {
        cleanup();
        process.exit(waitCode);
    }
    // Give storybook a moment to settle (mirrors `sleep 1` from the original bash)
    await new Promise((r) => setTimeout(r, 1000));

    const code = await run(
        'test-storybook',
        [
            '--url',
            url,
            '--index-json',
            '--config-dir',
            '.storybook',
            '--browsers',
            'chromium',
            '--maxWorkers',
            '3',
            ...(isA11y ? ['--excludeTags', 'skip-a11y'] : ['--includeTags', 'interaction']),
        ],
        testEnv
    );
    cleanup();
    process.exit(code);
} catch (err) {
    cleanup();
    console.error(err);
    process.exit(1);
}
