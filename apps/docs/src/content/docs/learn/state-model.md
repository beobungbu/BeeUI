---
title: State model
description: Which BeeUI components hold their own state, which require yours, and how to decide where a value belongs.
---

BeeUI components are **state-transparent by default**: a component holds internal state only for the interaction it owns, and any value your product cares about is passed in and reported back through a callback.

## Why the concept exists

"Controlled or uncontrolled" sounds like an API detail until it decides whether a user's half-filled form survives a re-render. BeeUI does not apply one blanket policy, because the right answer differs by component: whether a checkbox is ticked is almost always product state, while whether a tooltip is showing almost never is.

So instead of guessing, learn the three shapes BeeUI actually uses. Every component falls into one of them, and the exact props for each are on its [component reference](/docs/components/) page.

## The three shapes

```
shape 1 — always controlled       shape 2 — dual-mode               shape 3 — runtime-owned
──────────────────────────        ──────────────────────────        ───────────────────────
you hold the value                pass the prop  → you own it       the provider runtime
component renders and reports     omit it        → it owns it       owns the state; you
no internal fallback              `default*` seeds the uncontrolled  drive it imperatively
                                  path at mount only

Checkbox    checked/onCheckedChange    selection state                Toast   useToast()
Switch      value/onValueChange          Accordion  value/defaultValue        show / dismiss
Tabs        value/onValueChange          ChipGroup  value/defaultValue        dismissAll
RadioGroup  value/onValueChange          Select     value/defaultValue
SegmentedControl value/onValueChange
Input, Textarea                        open state
  (React Native TextInput semantics)     Dialog · AlertDialog · Sheet · Popover
                                         DropdownMenu · Tooltip · Collapsible · Select
                                         all use open/defaultOpen/onOpenChange
```

Shape 1 components have no internal fallback: they render exactly what you pass. Shape 2 components decide per prop — pass `value` and you own selection, omit it and they own it — and every overlay asks the same question separately for `open`. `Select` appears in both selection and open state because those two decisions are independent: you can control the value and let the surface manage its own open state.

## Rules and invariants

1. **A controlled prop needs its callback.** Pass `value` (or `checked`, or `open`) without the matching `onValueChange` / `onCheckedChange` / `onOpenChange` and the control becomes read-only: it renders your value and can never change it. BeeUI warns about this in development builds rather than failing silently in production.
2. **Do not switch modes at runtime.** Going from `undefined` to a defined `value` on an already-mounted component moves ownership mid-flight. Decide once per usage site.
3. **`defaultValue` is a seed, not a sync.** It is read when the component mounts. Changing it later does nothing; remounting is the only thing that re-reads it — which is why a conditionally rendered root silently resets.
4. **The overlay families enforce the pairing in the type system.** `Dialog`, `Popover`, `DropdownMenu`, `Sheet` and `Tooltip` type their props as a union: supply `open` and `onOpenChange` becomes required while `defaultOpen` is rejected; supply neither and `defaultOpen` is available. A controlled dialog that cannot close is therefore a compile error rather than a bug report.
5. **Uncontrolled state does not survive unmount.** If a navigation transition unmounts the screen, uncontrolled selection is gone. That is a correct outcome for a disclosure and a bug for a shopping cart.
6. **Overlay dismissal is runtime-arbitrated, not prop-arbitrated.** Even a controlled `open` still participates in the overlay runtime's depth-based dismissal; your callback is how you find out. See [Overlays & runtime ownership](/docs/learn/overlays-and-runtime/).

## Consequences for application code

The decision rule is short: **if the value has meaning outside the component, control it.**

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@beemvp/beeui-ui';

// Uncontrolled: which FAQ entry is open is a local interaction detail.
export function Faq() {
  return (
    <Accordion defaultValue="shipping">
      <AccordionItem value="shipping">
        <AccordionTrigger>Shipping</AccordionTrigger>
        <AccordionContent>Ships in two business days.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

```tsx
import * as React from 'react';
import { Checkbox, Field } from '@beemvp/beeui-ui';

// Controlled: consent is submitted, validated and audited — it is product state.
export function ConsentField() {
  const [accepted, setAccepted] = React.useState(false);
  return (
    <Field label="Terms">
      <Checkbox checked={accepted} onCheckedChange={setAccepted} />
    </Field>
  );
}
```

Practical consequences worth planning around:

- **Form values are always yours.** BeeUI ships no form engine, so the values, the dirty flags and the submit lifecycle live in your state or your form library. See [Forms model](/docs/learn/forms-model/).
- **Derived UI state usually is not.** A tooltip, a hover state, a disclosure inside a card — leave them alone; controlling them adds re-renders and gains nothing.
- **Controlled overlays are for cross-cutting rules.** Control `open` when routing, a mutation result or a guard needs to close a dialog. Otherwise `DialogTrigger` is less code and fewer states to get wrong.

## Common misconception

> "Controlled is the safe default, so I will control everything."

Controlling everything means every keystroke and every hover routes through your state tree. You pay in re-renders and in state you must now keep correct, and you gain nothing for values nobody outside the component reads. The mirror-image anti-pattern is worse: keeping a `useState` copy *alongside* an uncontrolled component and syncing it in an effect. That is two sources of truth that will disagree — pick one owner.

## Where to go next

- [Composition model](/docs/learn/composition-model/) — the root that owns this state.
- [Forms model](/docs/learn/forms-model/) — validation and submit ownership.
- [Overlays & runtime ownership](/docs/learn/overlays-and-runtime/) — open state and dismissal arbitration.
- [Components](/docs/components/) — the exact prop names and types per component.
- [Table guide](/docs/guides/table/) and [Date & time guide](/docs/guides/date-time/) — two surfaces where state ownership matters most.

## Source authority

- [`packages/ui/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/index.ts) — the exported prop types for every component.
- [`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md) — the canonical behavior catalog, including controlled/uncontrolled defaults.
