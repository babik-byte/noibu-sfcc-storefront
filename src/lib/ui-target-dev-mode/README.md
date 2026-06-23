# UITarget Development Mode

Visual debugging tool for UITarget extension points. **Zero production overhead** — all dev mode code is excluded from production builds.

## Quick Start

```bash
# Start dev server with target markers
npm run dev:ui-targets

# Visit any page
http://localhost:5173/product/some-product
```

All UITargets will have visual markers showing their ID and type.

---

## Features

### Visual Markers
- 🎯 **Badge** showing targetId
- **Type indicator**: `wrap` (wrapper) or `ins` (insertion)
- **Click to expand** for details (file location, usage code snippet, copy ID)
- **Dashed border** around wrapped content

### Floating Control Panel
- Shows live UITarget count for the current page
- Draggable — move it out of your way
- Collapse with the ▲/▼ button

---

## How It Works

### Zero Production Overhead

**Production Build:**
```typescript
// UITarget is a pure passthrough (40 bytes)
function UITarget({ children }) { return children }
```

**Development Build (VITE_UI_TARGET_DEV_MODE=true):**
- Vite plugin transforms `<UITarget>` → `<UITargetDevMarker>` at compile time
- Marker components lazy-loaded only when enabled
- Control overlay imported on-demand and mounted outside the React tree

---

## Architecture

```
┌─────────────────────────────────────────┐
│  UITarget Component (Production)         │
│  Pure passthrough: <>{children}</>      │
│  Bundle size: ~40 bytes                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Vite Plugin (Dev Only)                 │
│  - Runs at compile time                 │
│  - Transforms UITarget → UITargetDevMarker
│  - Adds __file__ and __hasChildren__ attrs
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  UITargetDevMarker (Dev Only)           │
│  - Visual badges                        │
│  - Click-to-expand details panel        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  UITargetDevOverlay (Dev Only)          │
│  - Lazy-loaded on demand                │
│  - Floating target count panel          │
└─────────────────────────────────────────┘
```

---

## Development Workflow

### Adding a New UITarget

1. Add the target in your component:
```tsx
<UITarget targetId="pdp.loyalty.badge">
  <LoyaltyWidget />
</UITarget>
```

2. Start dev mode:
```bash
npm run dev:ui-targets
```

3. Navigate to the page — you'll see the marker appear.

4. Click the marker to see details:
   - Target type (wrapper vs insertion)
   - File location
   - Code example
   - Copy ID button

### Smoke Test Mode

Verify all UITarget slots are reachable on any page without setting up `VITE_UI_TARGET_DEV_MODE`:

```bash
# Visit any page with this param
http://localhost:5173/product/some-product?uiTargetSmoke=1
```

Red markers appear for every registered UITarget, showing its ID and whether it is a wrapper or insertion point. This uses the extension system (not the Vite plugin) so it works in any environment — including production builds, if needed.

**Regenerate the smoke test config after adding new UITargets:**

```bash
pnpm smoke-test:generate
```

This scans the codebase for all `<UITarget>` usages and updates `src/extensions/ui-target-smoke-test/target-config.json`.

---

### Category Filter (Build-time)

To only show targets matching a specific category prefix:

```bash
VITE_TARGET_FILTER_CATEGORY=pdp npm run dev:ui-targets
```

Only targets whose `targetId` starts with `pdp.` will show markers.

---

## Troubleshooting

### Markers not appearing?

1. Check the env var is set:
```bash
echo $VITE_UI_TARGET_DEV_MODE  # Should print "true"
```

2. Use `npm run dev:ui-targets` which sets it automatically.

3. Check the console for the initialization message:
```
UITarget Dev Mode initialized
```

### Production build includes dev code?

This should never happen. To verify:

```bash
# Build production
npm run build

# Search for dev mode code
grep -r "UITargetDevMarker" dist/
# Should return no results
```

If dev code appears in production, file a bug report.

---

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_UI_TARGET_DEV_MODE` | `false` | Enable visual markers |
| `VITE_TARGET_FILTER_CATEGORY` | _(none)_ | Only show targets with this prefix (e.g. `pdp`) |

---

## Files

```
src/
  lib/
    ui-target-dev-mode/
      index.ts              # Initialization & exports
      marker.tsx            # Visual marker component
      overlay.tsx           # Floating control panel
      dev-colors.ts         # Shared color constants
      README.md             # This file
      smoke-test/
        generate-config.cjs # Script: scans codebase, writes to extensions/ui-target-smoke-test/

  extensions/
    ui-target-smoke-test/
      components/
        generic-marker.tsx  # Smoke test marker (loaded by the extension system)
      target-config.json    # Generated config — run `pnpm smoke-test:generate` to update

packages/storefront-next-dev/
  src/
    plugins/
      uiTargetDevMode.ts    # Vite plugin
```

---

## FAQ

**Q: Does this slow down development?**
A: No — the transform happens once during compilation, not on every render.

**Q: Can I use this in production?**
A: The system is designed to be dev-only. If you really need it:
```bash
VITE_UI_TARGET_DEV_MODE=true npm run build
```
⚠️ Not recommended — adds ~5KB to bundle.

---

## Related Documentation

- [UITarget Component](/src/targets/ui-target.tsx)
- [Extension System Overview](/src/extensions/README.md)
- [Vite Plugin Development](https://vitejs.dev/guide/api-plugin.html)
