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
import type { Meta, StoryObj } from '@storybook/react-vite';
import GenericSmokeMarker from '../generic-marker';

/**
 * `GenericSmokeMarker` reads `?uiTargetSmoke=1` once at module load. In Storybook the marker UI only appears
 * if the iframe URL already includes that query when the module first evaluates; otherwise the component
 * passes through (wrapper) or renders nothing (replacement). Stories here document both shapes for coverage.
 */
const meta: Meta<typeof GenericSmokeMarker> = {
    title: 'EXTENSIONS/UI target smoke / Generic marker',
    component: GenericSmokeMarker,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Dev-only overlay for UITarget smoke runs. When `uiTargetSmoke=1` is not active at load time, wrapped content still renders unchanged.',
            },
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WrapsChildren: Story = {
    args: {
        targetId: 'sfcc.example.wrapper',
        hint: 'story',
    },
    render: (args) => (
        <GenericSmokeMarker {...args}>
            <p className="text-sm text-muted-foreground">Wrapped slot content</p>
        </GenericSmokeMarker>
    ),
};

export const ReplacementSlot: Story = {
    args: {
        targetId: 'sfcc.example.replacement',
        hint: 'empty target',
    },
};
