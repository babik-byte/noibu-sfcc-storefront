# UI Components

This directory contains ejected [shadcn/ui](https://ui.shadcn.com/) components.

## Standards and Guidelines

### Component Management

**This folder is exclusively for ejected shadcn/ui components.**

- **DO NOT** create custom components in this directory
- **DO NOT** make manual modifications to ejected components
- **DO NOT** add components that are not from the shadcn/ui library

### Adding Components

To add new shadcn/ui components:

```bash
npx shadcn@latest add <component-name>
```

This will automatically eject the component into this directory with the correct configuration.

### Rationale

Maintaining this directory as a clean collection of ejected shadcn components ensures:

- Easy updates when shadcn/ui releases new versions
- Clear separation between library components and custom components
- Predictable component behavior across the codebase
- Simplified debugging and maintenance

### Questions?

If you need custom UI components, create them in `src/components/` or another appropriate directory outside of this folder.
