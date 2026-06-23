# Storybook Documentation

This project uses Storybook for component development, testing, and documentation. Storybook provides an isolated environment to develop and test UI components in isolation.

## Story-writing principles

Stories should be the *minimum* setup needed to render a component in a particular state. The four rules below keep stories cheap to write and resilient to internal refactors:

1. **Props-first.** Pass data via component props whenever the component accepts them. Reach for the global provider/router stack only when the component genuinely reads from global context (auth, basket, site, locale).
2. **Mock at the boundary, not at the internals.** Prefer `parameters.routeLoaderData` / `parameters.scapiMock` / `parameters.mockRoutes` (router-level) over `vi.mock(...)` of individual hooks. Hook mocks couple stories to internal refactors; route-level mocks survive them.
3. **Args are JSON-serializable; non-serializable data goes in `parameters`.** Storybook's args UI cannot render Promises, class instances, functions returning Promises, or circular structures — passing those as args breaks the controls panel and snapshot serialization. Use `parameters.routeLoaderData` for Promise-returning loader data.
4. **One reason to update a mock.** If changing a component's internals (a hook signature, a context shape) forces a story update, the story is mocking too deeply — push the mock down to the route or fixture layer.


## Decorator registry

Every story is wrapped, top-down, in:

```
withRouter(StoryShell)
  └── createMemoryRouter (in-memory, with default mock routes)
        └── StoryShell
              └── StorybookWrapper (config + site + i18n + auth + basket + storeLocator + checkoutOneClick)
                    └── UITargetProviders
                          └── <Story />
```

The pieces live in [`./decorators/`](./decorators/):

| File | Exports | Role |
|------|---------|------|
| `with-router.tsx` | `withRouter(Wrapper)` | Mounts the in-memory React Router and reads `parameters.routeLoaderData` / `scapiMock` / `mockRoutes`. |
| `with-providers.tsx` | `StorybookWrapper` | Provider stack (config/site/i18n/auth/basket/storeLocator/checkoutOneClick) on a `min-h-screen bg-background` shell. |
| `with-ui-targets.tsx` | `StoryShell` | `StorybookWrapper` + `UITargetProviders`. |
| `mock-routes.ts` | `buildDefaultMockRoutes(scapiMock, miniCartData)` | The default `/resource/*` and `/action/*` route table consumed by `withRouter`. |
| `index.ts` | barrel | `export { StorybookWrapper, StoryShell, withRouter, buildDefaultMockRoutes }`. |

Treat the providers as an **escape hatch**, not the default. Stories whose component takes the data via props should not require the global provider stack to render.

## Mock routes & data

Shared fixtures live in [`../src/components/__mocks__/`](../src/components/__mocks__/) (consumed by both stories and unit tests). Curated fixtures are re-exported from the [`index.ts` barrel](../src/components/__mocks__/index.ts) — import via `@/components/__mocks__` for the curated set, or via `@/components/__mocks__/<file>` for fixtures that aren't re-exported.

### Story-level overrides

The router decorator reads four story-level `parameters`:

- `routeLoaderData: Record<string, unknown>` — wrap the story in ancestor routes that resolve `useRouteLoaderData(routeId)` for the given ids. Use this for components like `CategoryBanner` that read loader data from a parent route.
- `scapiMock: { data?: unknown }` — override the default `/resource/api/client/:resource` loader response. Required when a play function asserts against story-specific product data (e.g. `BonusProductModal`'s tie fixture).
- `miniCartData: { basket, productsById }` — override what the `/resource/basket-products` mock returns. Required by stories that need a different basket shape than the populated default (e.g. CartSheet "Empty" story).
- `mockRoutes: RouteObject[]` — append story-specific mock routes (extra `/resource/*` or `/action/*` paths) without forking the decorator. Story-supplied paths must not shadow `/`, `*`, or any default mock-route path — `withRouter` throws on conflicts.

### Default mock routes

`buildDefaultMockRoutes(scapiMock, miniCartData)` provides a loader for basket-product enrichment and actions for cart updates, wishlist mutations, OTP verification, product/bundle/set adds, site-context (currency/locale) updates, tracking-consent, and place-order. See [`./decorators/mock-routes.ts`](./decorators/mock-routes.ts) for the full list.

## Quick Start

```bash
# Start Storybook development server
pnpm storybook

# Build Storybook for production
pnpm storybook:build
```

## Run tests on Command Line Interface

```bash
# Run snapshot tests
pnpm storybook:test --type=snapshot

# Update snapshot files locally and run tests
pnpm storybook:test --type=snapshot --update

# Run interaction tests
pnpm storybook:test --type=interaction

# Run interaction tests against static build
pnpm storybook:test --type=interaction --static

# Run a11y tests
pnpm storybook:test --type=a11y

# Run a11y tests against static build
pnpm storybook:test --type=a11y --static
```

**Storybook URL:** http://localhost:6006

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm storybook` | Start Storybook development server on port 6006 |
| `pnpm storybook:build` | Build static Storybook for production deployment |
| `pnpm storybook:test --type=snapshot` | Run snapshot tests |
| `pnpm storybook:test --type=snapshot --update` | Update snapshot files locally and run tests |
| `pnpm storybook:test --type=interaction` | Run interaction tests against live Storybook server |
| `pnpm storybook:test --type=interaction --static` | Run interaction tests against static Storybook build |
| `pnpm storybook:test --type=a11y` | Run a11y tests against live Storybook server |
| `pnpm storybook:test --type=a11y --static` | Run a11y tests against static Storybook build |

## Features & Addons

This Storybook setup includes the following addons:

- **@storybook/addon-docs** - Automatic documentation generation
- **@storybook/addon-a11y** - Accessibility testing and validation
- **@storybook/addon-vitest** - Integration with Vitest for component testing
- **@chromatic-com/storybook** - Visual testing and review (optional)
- **Viewport Toolbar** - Built-in toolbar for testing different screen sizes (Mobile, Tablet, Desktop)

> **Note**: We use Storybook's built-in viewport toolbar instead of creating separate viewport stories. Use the viewport selector in the Storybook toolbar to test components at different screen sizes.

## Project Structure

```
src/
├── components/
│   ├── __mocks__/                        # Shared fixtures (stories + unit tests)
│   │   └── index.ts                      # Curated barrel
│   ├── buttons/
│   │   ├── login-submit-button.tsx
│   │   └── login-submit-button.stories.tsx
│   └── ui/
│       ├── button.tsx
│       └── button.stories.tsx
└── .storybook/
    ├── main.ts
    ├── vite.config.ts
    ├── preview.tsx                       # Imports + parameters + decorator wiring
    ├── decorators/                       # withRouter, StorybookWrapper, StoryShell, mock-routes
    ├── storybook-providers.tsx           # The provider stack (config/site/i18n/auth/...)
    ├── test-wrapper.tsx                  # Snapshot-only wrapper (codegen — see header comment)
    └── shims/
        └── shopper-agent-context-ui.ts   # Storybook-only (see below)
```

### Production vs Storybook: `shopper-agent-context-ui` shim

PDP FAQ and the account Need Help **Ask a question** action are gated in production by `src/lib/shopper-agent-context-ui.ts`. Storybook still needs those UIs to show up in stories without changing production defaults.

**What we do:** `.storybook/vite.config.ts` adds a resolve alias so `@/lib/shopper-context/agent-ui` points at `.storybook/shims/shopper-agent-context-ui.ts` when Storybook builds. That shim implements `isShopperAgentContextUiEnabled()` as `true` while the production file returns the real `SHOPPER_AGENT_CONTEXT_UI_ENABLED` constant. The storefront `vite build` and Vitest unit tests resolve the normal `src/lib/` module — no Storybook branching in shipped code.

**Why not `globalThis` in production utilities?** Putting Storybook detection in shared runtime code mixes concerns, invites duplicated magic strings (`preview.tsx`, tests, utils), and adds an unnecessary branch on every call.

**Why not environment variables for “am I Storybook?”** An `import.meta.env.STORYBOOK`-style flag would still require production modules to depend on Storybook-specific keys or strip them carefully in prod builds. Env is also easier to get wrong across CI, Managed Runtime, and local dev. A **build-time module alias** limits the override to the Storybook bundle only.

**Unit tests:** Mock `@/lib/shopper-context/agent-ui` when you need context UI enabled; otherwise imports use the real module (`false` until you change the constant).

## Creating Stories

### Basic Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Description of what this component does.',
      },
    },
  },
  argTypes: {
    // Define controls for component props
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline'],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};
```

### Basic Story Structure with Play function for Interaction Tests

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import { within, userEvent } from '@storybook/test';
import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: 'primary' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
  },
};
```

### Basic Story Structure with Actions

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActionLogger } from './ActionLogger';

const meta: Meta<typeof ActionLogger> = {
  title: 'Utils/ActionLogger',
  component: ActionLogger,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <ActionLogger>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button>Edit</button>
        <button>Remove</button>
      </div>
    </ActionLogger>
  ),
};
```

### Story Best Practices

**Do:**
1. **Naming Convention**: Use PascalCase for story names (e.g., `Default`, `Loading`, `Error`)
2. **Organization**: Group related stories under logical categories
3. **Documentation**: Include component descriptions and prop documentation
4. **Controls**: Use `argTypes` to make components interactive
5. **Variants**: Create stories for different states (loading, error, success)
6. **Accessibility**: Test with the a11y addon
7. **Viewport Testing**: Use Storybook's built-in viewport toolbar instead of creating separate Mobile/Tablet/Desktop stories

**Don't (anti-patterns):**
- **Massive mock equivalents of the component.** Recreating the component's data shape inside the story (huge nested literals) instead of passing props.
- **Promises through `args`.** They don't serialize; the controls panel breaks. Move them to `parameters` (e.g. `parameters.routeLoaderData`).
- **`vi.mock(...)` of hooks inside a story.** Should be route-level (a mock loader/action) or replaced with a prop.

## ESLint Integration

This project includes `eslint-plugin-storybook` for Storybook-specific linting:

- Enforces Storybook best practices
- Catches common mistakes in story files
- Ensures consistent story structure
- Validates story naming conventions

## Troubleshooting

### Common Issues

1. **Port Already in Use**: Change the port in the storybook command
   ```bash
   pnpm storybook --port 6007
   ```

2. **Build Errors**: Check that all dependencies are installed
   ```bash
   pnpm install
   ```

3. **Story Not Loading**: Verify the story file follows the correct naming convention (`*.stories.tsx`)

4. **TypeScript Errors**: Ensure your component props are properly typed

### Getting Help

- Check the [Storybook documentation](https://storybook.js.org/docs)
- Review existing stories in the project for examples
- Use the Storybook UI to explore available controls and addons

## Contributing

When adding new components:

1. Create the component in the appropriate directory
2. Add a corresponding `.stories.tsx` file
3. Include multiple story variants
4. Test accessibility with the a11y addon
5. Document the component's purpose and usage
6. Ensure the story passes ESLint checks