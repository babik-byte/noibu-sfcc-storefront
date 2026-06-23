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
import { vi, expect, test, describe, afterEach } from 'vitest';
import { composeStories } from '@storybook/react-vite';
// eslint-disable-next-line import/no-namespace
import * as ProductRecommendationsStories from './index.stories';
import { render, cleanup } from '@testing-library/react';

// Hoist dependencies for use in vi.mock (avoids async imports which fail on Windows)
const { createContext: reactCreateContext, actualReactRouter } = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reactRouter = require('react-router');
    return { createContext: React.createContext, actualReactRouter: reactRouter };
});

// Mock the necessary hooks and providers
vi.mock('@/hooks/recommenders/use-recommenders', () => ({
    useRecommenders: vi.fn(() => ({
        isLoading: false,
        isEnabled: true,
        recommendations: {
            recoUUID: 'test-uuid',
            recommenderName: 'pdp-similar-items',
            displayMessage: 'You May Also Like',
            recs: [],
        },
        error: null,
        getRecommenders: vi.fn(),
        getRecommendations: vi.fn(),
        getZoneRecommendations: vi.fn(),
    })),
}));

// Mock react-router hooks
vi.mock('react-router', () => {
    return {
        ...actualReactRouter,
        createContext: reactCreateContext,
        useNavigate: () => vi.fn(),
        useLocation: () => ({
            pathname: '/',
            search: '',
            hash: '',
            state: null,
            key: 'default',
        }),
        useResolvedPath: () => ({ pathname: '/', search: '', hash: '' }),
        useHref: () => '/',
        Link: (props: any) => (
            <a href={props.to} {...props}>
                {props.children}
            </a>
        ),
        NavLink: (props: any) => (
            <a href={props.to} {...props}>
                {props.children}
            </a>
        ),
    };
});

const composed = composeStories(ProductRecommendationsStories);

afterEach(() => {
    cleanup();
});

describe('ProductRecommendations stories snapshot', () => {
    for (const [storyName, Story] of Object.entries(composed)) {
        if (Story?.parameters?.snapshot === false || /interactiontests?/i.test(storyName)) continue;
        test(`${storyName} story renders and matches snapshot`, () => {
            const { container } = render(<Story />);
            expect(container.firstChild).toMatchSnapshot();
        });
    }
});
