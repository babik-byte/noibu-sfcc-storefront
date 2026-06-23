<!--
  Copyright 2026 Salesforce, Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

# Storybook Review Plan — Checkout Components

**Branch:** `syadupathi.W-22342644.uxCleanup`  
**Guidelines reference:** [Storybook Enablement Guide — Expectations for All Teams](https://docs.google.com/document/d/1OkKccQAH56GfJhcAok8Kd6L8DyD3O0gGEzSYM8X9vnk/edit?tab=t.0#heading=h.5nrsn08va97f)  
**Context:** PR #1531 completed Steps 1 & 6 (docs + argTypes). This plan covers Steps 2–5 and 7–9.

---

## What PR #1531 Already Covered

- Rewrote component descriptions to match the current implementation
- Added `table` metadata (type summaries, default values) to all `argTypes`
- Added missing props to `argTypes` (`disabled`, `showUseDifferentBilling`, `enableMultiAddress`, etc.)
- Added new snapshot files for components missing them
- Added `checkout-skeletons.stories.tsx` as a new file

**PR #1531 did not touch any play functions.** All interaction test issues remain open.

---

## Remaining Work by Component

### Priority Order

| Priority | Component | Main work |
|---|---|---|
| 1 | Extract `ActionLogger` | Unblocks clean work in 4 files |
| 2 | `payment` | Remove meta-level play; fix CompletedState/DisabledState/LoadingState; fix WithBillingAddress |
| 3 | `contact-info` | Fix LoadingState + WithValidationError plays; `void` → `await` |
| 4 | `shipping-options` | Fix wrong role queries; fix CompletedState/DisabledState; move decorator |
| 5 | `shipping-address` | Remove redundant stories; fix LoadingState/WithValidationErrors; `void` → `await` |
| 6 | `shipping-address-display` | Strengthen trivial plays; rename story |
| 7 | `saved-addresses-list` | `void` → `await`; add AddNewAddress story |
| 8 | `register-customer-selection` | Decorator cleanup; fix Checked play; add argTypes |
| 9 | `checkout-skeletons` | Convert MyCartWithManyItems to args style |

---

### 0. Cross-Cutting: Extract Shared ActionLogger

`ActionLogger` is copy-pasted ~300 lines each across `contact-info`, `payment`, `shipping-address`, and `shipping-options`. Extract to:

```
src/components/checkout/storybook/checkout-action-logger.tsx
```

All four files import from there. This matches the existing pattern for `checkoutStrictA11yParameters`.

---

### 1. `checkout-skeletons.stories.tsx` — Low risk

**File:** `src/components/checkout/components/stories/checkout-skeletons.stories.tsx`

| Issue | Change |
|---|---|
| `MyCartWithManyItems` uses `render: () => <MyCartSkeleton itemCount={5} />` — `itemCount` not exposed as a control | Convert to `args: { itemCount: 5 }` with `component: MyCartSkeleton` on the story |

---

### 2. `contact-info.stories.tsx` — Medium effort

**File:** `src/components/checkout/components/stories/contact-info.stories.tsx`

| Story | Problem | Fix |
|---|---|---|
| `WithExistingEmail` | Identical args + play to `Default` — no observable difference | Remove or differentiate with a mock that pre-fills email/phone |
| `LoadingState` | `isLoading: true` but play calls `userEvent.type` into inputs — doesn't verify loading behavior | Verify submit button is disabled; verify inputs are disabled |
| `WithValidationError` | Play types into email field instead of asserting the error message renders | Assert `getByText('Please enter a valid email address')` is in document |
| `CompletedState` | Not `async`; `void expect()` — failures swallowed | Make async, add `waitForStorybookReady`, use `await expect()` |
| `DisabledState` | Same — not `async`, `void expect()` | Same fix |
| All stories | `void expect()` throughout | Replace all `void expect()` → `await expect()` |

---

### 3. `payment.stories.tsx` — High effort, most broken

**File:** `src/components/checkout/components/stories/payment.stories.tsx`

| Issue | Fix |
|---|---|
| **Meta-level `play` function** (lines 189–204) — runs before every story's play, blindly clicks first input and button | **Remove it** |
| `WithExistingPayment` — identical args + play to `Default`, no basket mock | Remove or differentiate (e.g. `showUseDifferentBilling: false`) |
| `WithBillingAddress` — same args as `Default`, `showUseDifferentBilling` not set to trigger billing section | Set `showUseDifferentBilling: true` in args; update play to click the checkbox and assert billing fields appear |
| `CompletedState` play — generic click pattern on a view with no form inputs | Assert `queryAllByRole('textbox').length === 0`; verify edit button is present |
| `DisabledState` play — same generic pattern | Assert `queryAllByRole('textbox').length === 0` |
| `LoadingState` — no `waitForStorybookReady` | Add `await waitForStorybookReady(canvasElement)` |
| `DesktopView` — `isCompleted: true, isEditing: false` while `MobileView`/`TabletView` are `isEditing: true` | Make viewport stories consistent |
| Commented-out decorator block (lines 107–116) | Remove dead code |

---

### 4. `register-customer-selection.stories.tsx` — Low effort

**File:** `src/components/checkout/components/stories/register-customer-selection.stories.tsx`

| Issue | Fix |
|---|---|
| All stories use `render:` — bypasses component prop table in Docs | Move `RegisterStoryHarness` to `meta.decorators`; use `args` on each story |
| `argTypes` missing `onSaved` | Add `argTypes` entry with description and type |
| `Checked` play — after `userEvent.click`, only checks checkbox is still in document, not that it became checked | Assert `checkbox` has `aria-checked="true"` after click |
| `Checked` vs `WithCallback` — near-identical plays, no clear differentiation | Remove `WithCallback` or make it verifiably distinct |

---

### 5. `saved-addresses-list.stories.tsx` — Low effort (best-written file)

**File:** `src/components/checkout/components/stories/saved-addresses-list.stories.tsx`

| Issue | Fix |
|---|---|
| `void expect()` throughout — failures swallowed | Replace all `void expect()` → `await expect()` |
| No story for `onAddNewAddress` prop | Add `AddNewAddress` story: `args: { addresses: addresses.slice(0,2), onAddNewAddress: action('onAddNewAddress') }`; play verifies "Add New Address" button renders |

---

### 6. `shipping-address-display.stories.tsx` — Low effort

**File:** `src/components/checkout/components/stories/shipping-address-display.stories.tsx`

| Story | Problem | Fix |
|---|---|---|
| `Default` | Play only checks `firstChild` is in document | Assert `getByText('Jane Doe')`, `getByText(/123 Main/)`, `getByText(/San Francisco/)` |
| `WithPhone` | Same trivial assertion | Assert `getByText('555-123-4567')` is visible |
| `CardVariantWithDefault` | Same trivial assertion; name is confusing | Assert "Default" badge renders; rename to `CardVariantPreferred` |

---

### 7. `shipping-address.stories.tsx` — Medium effort

**File:** `src/components/checkout/components/stories/shipping-address.stories.tsx`

| Issue | Fix |
|---|---|
| `WithExistingAddress` — identical args + play to `Default`, no basket mock | Remove (zero additional coverage without a basket mock) |
| `InternationalAddress` — identical args + play to `Default`, no country change | Remove or distinguish: pass `countryCode: 'GB'` if the component accepts it at the prop level |
| `LoadingState` play — verifies inputs exist but not that they're disabled | Assert `getByLabelText(/First Name/i)` is disabled (`toBeDisabled()`) |
| `WithValidationErrors` play — doesn't assert error messages render | Assert `getByText('First name is required')` etc. are in document |
| `void expect()` throughout | Replace all `void expect()` → `await expect()` |
| Commented-out decorator block (lines 447–457) | Remove dead code |

---

### 8. `shipping-options.stories.tsx` — Medium effort

**File:** `src/components/checkout/components/stories/shipping-options.stories.tsx`

| Issue | Fix |
|---|---|
| `WithMultipleOptions` play — queries `queryAllByRole('textbox')` but component uses radios | Use `queryAllByRole('radio')`; assert 3 options render; click one and verify it becomes checked |
| `WithFreeShipping` play — same wrong role | Assert "Free Standard Shipping" text visible; verify the $0 option can be selected |
| `CompletedState` play — generic click pattern | Assert `queryAllByRole('radio').length === 0`; verify selected method name appears in summary |
| `DisabledState` play — generic click | Assert no radio group rendered |
| `Default` and `LoadingState` — no `waitForStorybookReady` | Add `await waitForStorybookReady(canvasElement)` |
| `ActionLogger` added as per-story decorator on every export | Move to `meta.decorators` |

---

## Checklist Against Guidelines

| Step | Guideline | Status |
|---|---|---|
| 1 | Docs tab accurate, props correct | ✅ Done in PR #1531 |
| 2 | Stories represent valid, meaningful states | ⬜ Remove/fix redundant stories |
| 3 | Interaction tests reflect real user flows | ⬜ Fix play functions (main scope) |
| 4 | Snapshot DOM correct | ⬜ Verify after interaction fixes |
| 5 | A11y violations resolved | ⬜ Run `pnpm storybook:test --type=a11y` locally |
| 6 | Controls/args match public API | ✅ Done in PR #1531 |
| 7 | Responsive variants accurate | ⬜ Fix DesktopView inconsistency in payment |
| 8 | Interaction tests pass locally | ⬜ Run `pnpm storybook:test --type=interaction` |
| 9 | Clean naming, no dead code | ⬜ Remove commented decorators, redundant stories |

---

## Skill Template Outline (`storybook-review`)

For building a reusable skill based on this exercise:

1. **Docs check** — Is the component description accurate? Are all props in `argTypes` with types and defaults?
2. **Story validity** — Do sibling stories have identical args? Does the story name match what the args configure?
3. **Play function quality** — Does each play assert component-specific content (not just `toBeInTheDocument`)? Are the right ARIA roles queried (radio vs textbox vs checkbox)?
4. **Assertion hygiene** — Flag `void expect()` (failures silently swallowed), missing `async` on play functions, missing `await waitForStorybookReady`.
5. **Meta structure** — Flag meta-level `play` (almost always wrong); flag per-story decorator duplication vs meta-level decorator.
6. **Responsive stories** — Are viewport stories in consistent arg states?
7. **Dead code** — Flag commented-out decorators, unreachable branches, unused imports.
8. **Shared code extraction** — Flag copy-pasted harness/decorator code across sibling story files.
