# Extensions Directory

This folder contains **feature extensions** that allow you to enhance and customize your storefront experience in a modular way.

## Purpose

The `extensions` directory is the central place for developing and managing reusable application extensions, such as UI widgets, backend integrations, or business logic add-ons. Files under each is self-contained and can be included individually, making it easy to add new features or integrations to your retail application. 

## Extension Target

### Component
Extension components can be inserted into target points defined in the main application. These target points are marked with the `UITarget` element, each identified by a unique targetId. For example:

```
<UITarget targetId='header.before.cart' />
```

To insert a component into a target point, configure the `target-config.json` file under `src/extensions/<your-extension>` folder. For example: 

```
{
    "components": [
        {
            "targetId": "header.before.cart",
            "path": "extensions/store-locator/components/header/store-locator-badge.tsx",
            "order": 0
        }
    ]
}
```
When more than one components target the same targetId, they'll be rendered in ascending order as specified.

### Context provider

Similarly, a custom context provider can also be inserted into the application root (root.tsx):

```
{
  "contextProviders": [
        {
            "path": "extensions/store-locator/providers/store-locator.tsx",
            "order": 0
        }
    ]
}
```

### Route
To add a custom route for an extension, simply create a new file under the `src/extensions/<your-extension>/routes` folder. Any file under this folder will be processed as a new route.

## Extension Integration
This folder contains only "net-new" files related to an extention. Integration changes, i.e., additional code changes to the core application, are made in files outside the extension folder. They're marked by special comment markers to indicate the annotated code snippet is a part of an extension.

Example integration code:

- A single line of code
```typescript
/** @sfdc-extension-line SFDC_EXT_STORE_LOCATOR */
import storeLocator from '@extensions/store-locator'
```

- A block of code
```typescript
{/* @sfdc-extension-block-start SFDC_EXT_STORE_LOCATOR */}
<li>
    <Link to="/store-locator" className="hover:underline">
        {uiStringsSL.footer.links.storeLocator}
    </Link>
</li>
{/* @sfdc-extension-block-end SFDC_EXT_STORE_LOCATOR */}

```

- An entire file
```typescript
/** @sfdc-extension-file SFDC_EXT_STORE_LOCATOR */
...
```


## How Extensions Are Registered

Each extension is registered via the `config.json` file located in the `extensions` directory. Each entry is keyed by a unique marker string, which is used to mark code snippets where extension code is integrated with rest of the application. During the app creation process, a user chooses which extension to include based on the registry.

## Extensions Structure

Example structure:

```
src/extensions/
  config.json
  my-extension/
    index.ts
    [other extension files...]
  another-extension/
    index.ts
```

## Extension Internationalization

Extensions support internationalization (i18n) through the same i18next system used by the core application. Each extension can maintain its own translation files that are discovered and integrated during the build process (when you run `pnpm dev` or `pnpm build`).

### Adding Translations to Your Extension

Create translation files within your extension's `locales` directory:

```
src/extensions/
  my-extension/
    components/
    locales/
      en-US/
        translations.json
      it-IT/
        translations.json
    index.ts
```

Your extension's translations will automatically be namespaced as `extMyExtension` (using PascalCase of your extension folder name). This prevents namespace collisions with core application translations and other extensions.

### Usage Example

```typescript
import { useTranslation } from 'react-i18next';

export function MyExtensionComponent() {
    const { t } = useTranslation('extMyExtension');
    return <h1>{t('welcome')}</h1>;
}
```

For complete documentation on i18n, including usage patterns, best practices, and examples, see [README-I18N.md](../../docs/README-I18N.md#extension-translations).

## Generating Installation/Uninstallation Instructions
If you’re building an extension for customer distribution, you can generate installation and uninstallation instructions that both humans and LLMs can follow to complete the install/uninstall steps.
```
npx @salesforce/storefront-next-dev create-instructions -d /path/to/this/project -c /path/to/src/extensions/config.json -e SFDC_EXT_STORE_LOCATOR -p https://github.com/your/template.git -f /path/to/src/extensions/your-extension
```
 Complete options:

 - `-d, --project-directory <dir>`: Project directory
- `-c, --extension-config <config>`: Extension config JSON file location
- `-e, --extension <extension>`: Extension marker value (e.g. SFDC_EXT_featureA)
- `-p, --template-repo <repo>`: Your storefront template repo URL (default: https://github.com/SalesforceCommerceCloud/storefront-next-template.git)
- `-b, --branch <branch>`: PWA repo branch (default: main)
- `-f, --files <files...>`: Specific files/folder to include (relative to project directory, e.g., src/extensions/store-locator)
- `-o, --output-dir <dir>`: Output directory (default: ./instructions)

## `config.json` Schema

Each `config.json` must adhere to the following schema:

| Field                         | Type     | Required | Description                                                                   |
| ----------------------------- | -------- | -------- | ----------------------------------------------------------------------------- |
| `name`                        | string   | yes      | Human-readable name of the extension                                          |
| `description`                 | string   | yes      | A short description of what the extension does                                |
| `installationInstructions`    | string   | no       | (Optional) Path to file with installation instructions                        |
| `uninstallationInstructions`  | string   | no       | (Optional) Path to file with uninstallation instructions                      |
| `folder`                      | string   | no       | (Optional) Folder containing extension specfic code                           |

### Example `config.json`

```json
"SFDC_EXT_PRODUCT_REVIEW": {
  "name": "Product Review",
  "description": "Product review allows a user to see reviews of a product and create new reviews.",
  "installationInstructions": "instructions/install-product-review.mdc",
  "uninstallationInstructions": "instructions/uninstall-product-review.mdc",
  "folder": "product-review"
}
```

## Action Hooks

Action hooks let extensions run server-side logic at specific points in the checkout flow — for example, fraud screening after contact info is submitted, address verification, or payment tokenization before order placement.

### Action Hooks vs SCAPI Hooks

Action hooks and SCAPI hooks operate at different layers and are complementary:

- **Action hooks** run in the **storefront (head)** during server action execution. Use them for logic that belongs in the presentation layer — fraud screening, address verification, payment tokenization/3DS, or enriching data between checkout steps. They have access to the React Router action context and can read/modify the response before it reaches the client.
- **SCAPI hooks** run in the **Commerce Cloud backend** when SCAPI endpoints are called. Use them for logic that should apply regardless of which head (or headless client) is calling the API — order-level validations, inventory holds, pricing overrides, or backend workflow triggers.

**Rule of thumb:** If the logic depends on the storefront UI flow or needs to gate a checkout step before/after an API call, use an action hook. If the logic should enforce a business rule at the API layer for all consumers, use an SCAPI hook.

### How They Work

Each checkout server action contains calls to `runHook(hookId, context)`. When your extension registers a handler for a given `hookId`, it runs as part of a **waterfall**: handlers execute in series (ordered by `order`), each receiving the previous handler's output. If no handlers are registered for a hook, the original context passes through unchanged.

Handlers receive an `ActionHookContext` with:
- `data` — the action's current data (e.g., basket, payment info, address)
- `actionContext` — the React Router action context (for API access)

Handlers can:
- **Enrich**: Return modified `data` to add information for the next step
- **Transform**: Return modified `data` to change values (e.g., filter shipping methods)
- **Abort**: Throw an `ActionHookError` to stop the action and return a user-facing error

### Registering Action Hooks

Add an `actionHooks` array to your extension's `target-config.json`:

```json
{
    "components": [],
    "actionHooks": [
        {
            "hookId": "sfcc.checkout.fraud.afterSubmitContactInfo",
            "handler": "extensions/my-extension/hooks/fraud-check.ts",
            "order": 0
        },
        {
            "hookId": "sfcc.checkout.payments.beforePlaceOrder",
            "handler": "extensions/my-extension/hooks/tokenize-payment.ts",
            "order": 0
        }
    ]
}
```

When multiple extensions register handlers for the same `hookId`, they run in ascending `order`.

### Writing a Handler

A handler is a default-exported async function that receives the hook context and returns it (potentially modified):

```typescript
import type { ActionHookContext } from '@/targets/action-hook.server';
import { ActionHookError } from '@/targets/action-hook.server';

export default async function fraudCheck(context: ActionHookContext) {
    const { data, actionContext } = context;

    const result = await callFraudService(data.email);

    if (result.blocked) {
        // Throwing ActionHookError aborts the action with a user-facing message
        throw new ActionHookError(
            'Order cannot be processed. Please contact support.',
            'sfcc.checkout.fraud.afterSubmitContactInfo',
            'contactInfo'
        );
    }

    // Return context to continue the action (modify data if needed)
    return context;
}
```

### Error Handling: Blocking vs Non-Blocking Hooks

Hooks are classified by where they appear in the checkout flow:

**Blocking hooks** (pre-order gates) — if the handler throws an unexpected error, the action fails. These hooks guard critical operations and must succeed before proceeding:
- `sfcc.checkout.fraud.beforePlace`
- `sfcc.checkout.payments.beforePlaceOrder`

**Non-blocking hooks** (post-action enrichment) — if the handler throws an unexpected error, the action logs the error and continues. These hooks enrich or observe but should not prevent checkout:
- `sfcc.checkout.fraud.afterSubmitContactInfo`
- `sfcc.checkout.addressVerification.afterSubmitShippingAddress`
- `sfcc.checkout.shipping.afterMethodsFetch`
- `sfcc.checkout.shipping.afterMethodSelect`
- `sfcc.checkout.payments.afterSubmitPayment`
- `sfcc.checkout.payments.afterPlaceOrder`

In both cases, throwing `ActionHookError` intentionally aborts the action with a user-facing error response. The blocking/non-blocking distinction only affects what happens when an *unexpected* error occurs.

### Timeout and Per-Handler Isolation

Each handler has a **5-second timeout**. If a handler exceeds this limit, it is treated the same as an unexpected error — the behavior depends on whether the hook is blocking or non-blocking.

When multiple handlers are registered for the same hook ID, they run in series (waterfall). Error isolation is per-handler:

- **Non-blocking hooks**: a failing handler is logged and skipped; the next handler receives the last successful context. The remaining handlers still run.
- **Blocking hooks**: any handler failure (including timeout) immediately aborts the waterfall and fails the action.

### Available Hook IDs

| Hook ID | Server Action | Blocking | Description |
|---------|---------------|----------|-------------|
| `sfcc.checkout.fraud.afterSubmitContactInfo` | submit-contact-info | No | Fraud/identity checks after email and phone are saved |
| `sfcc.checkout.addressVerification.afterSubmitShippingAddress` | submit-shipping-address | No | Address verification after shipping address is saved |
| `sfcc.checkout.shipping.afterMethodsFetch` | submit-shipping-address | No | Enrich or filter shipping methods after fetch |
| `sfcc.checkout.shipping.afterMethodSelect` | submit-shipping-options | No | Post-processing after shipping method selection |
| `sfcc.checkout.payments.afterSubmitPayment` | submit-payment | No | Post-processing after payment instrument is added (e.g., tokenization) |
| `sfcc.checkout.fraud.beforePlace` | place-order | Yes | Fraud gate before order creation |
| `sfcc.checkout.payments.beforePlaceOrder` | place-order | Yes | Payment gate before order creation (e.g., 3DS verification) |
| `sfcc.checkout.payments.afterPlaceOrder` | place-order | No | Post-order processing (e.g., capture, analytics) |

### Build-Time Optimization

Action hooks use a **virtual module** (`virtual:action-hooks`) generated by the Vite plugin at build time. The plugin reads all `target-config.json` files, collects `actionHooks` entries, and generates a module that imports only the registered handlers. If no handlers are registered for any hook, the generated module is a no-op passthrough — no extension code is included in the bundle.

### Testing with Action Hooks

In Vitest, the virtual module is replaced by a mock alias (configured in `vite.config.ts`) that passes context through unchanged. To test your handler in isolation, import and call it directly:

```typescript
import myHandler from '@/extensions/my-extension/hooks/my-handler';

test('handler enriches data', async () => {
    const context = { data: { basket: mockBasket }, actionContext: {} };
    const result = await myHandler(context);
    expect(result.data.basket.customField).toBe('enriched');
});
```

## Adding an Extension

1. Create a new subdirectory in `src/extensions/`.
2. Add your extension code files.
3. Add your extension integration code.
4. Generate install/uninstall instructions.
5. Create a new entry in `config.json` per the schema above.

