---
title: Composition model
description: How BeeUI compound components share context, why the parts are separate exports, and the composition rules that keep behavior intact.
---

A BeeUI compound component is **one root that owns state and context, plus named part components that read it** — so the parts stay in your markup where you can style and reorder them, while the behavior stays in one place.

## Why the concept exists

A `Select` needs a trigger, a value display, a surface, groups, labels and items. There are two ways to expose that. A configuration API takes an `options` array and renders everything for you: easy at first, then a wall of escape-hatch props the moment a real product needs an icon in an item or a section header in the middle. A composition API hands you the parts.

BeeUI chose composition, and paid for it with a rule: the parts only work inside their root, because that is where their shared context lives.

## The shape

```
Select                      ← owns open state, selected value, dismissal scope
├── SelectTrigger           ← reads context: opens, reflects disabled/invalid
│   └── SelectValue         ← reads context: renders current selection
└── SelectContent           ← portals into the overlay runtime, positions to anchor
    └── SelectGroup
        ├── SelectLabel
        └── SelectItem      ← reads context: reports selection back to the root
```

Every compound family in BeeUI has the same shape, only the names change:

| Family | Root | Typical parts |
| --- | --- | --- |
| [`Select`](/docs/components/select/) | `Select` | `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectGroup`, `SelectLabel`, `SelectItem` |
| [`Dialog`](/docs/components/dialog/) | `Dialog` | `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` |
| [`Sheet`](/docs/components/sheet/) | `Sheet` | `SheetTrigger`, `SheetContent`, `SheetHandle`, `SheetTitle`, `SheetDescription`, `SheetFooter`, `SheetClose` |
| [`Tabs`](/docs/components/tabs/) | `Tabs` | `TabsList`, `TabsTrigger`, `TabsContent` |
| [`Accordion`](/docs/components/accordion/) | `Accordion` | `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| [`Field`](/docs/components/field/) | `Field` | any control as `children`; label, description and error are props |

A minimal, representative composition:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@beemvp/beeui-ui';

export function CurrencySelect({ onValueChange, value }: CurrencySelectProps) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger>
        <SelectValue placeholder="Choose a currency" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="usd">US dollar</SelectItem>
        <SelectItem value="vnd">Vietnamese dong</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

## Rules and invariants

1. **Parts must render inside their root.** They read React context, not props you thread manually. A part rendered outside its root has no context to read, and the failure is a runtime error or dead interaction rather than a type error.
2. **Do not hoist a trigger out of its family.** Moving `SelectTrigger` into a shared header component and leaving `SelectContent` behind breaks anchoring, dismissal arbitration and focus restoration at once. If you need a custom trigger surface, put your custom node *inside* `SelectTrigger`.
3. **Composition is where you customize; variants are how you style.** Reach for `variant`, `size` and `tone` props first; use `className` when the engine escape hatch is genuinely needed, knowing it is not a portability promise.
4. **The root is the state boundary.** Selection, open state and dismissal belong to the root — see [State model](/docs/learn/state-model/).
5. **Every part is a public export of `@beemvp/beeui-ui`.** If a part is not exported from the package barrel, it is internal and not part of the contract, even if the file resolves.
6. **`children` is the extension point.** Adding your own nodes inside a part is expected. Replacing a part with your own component that mimics it is not, because the context contract goes with the part.

## Consequences for application code

- Your product component wraps the *whole family*, not a single part. `CurrencySelect` above is the right granularity; a `CurrencySelectTrigger` that lives in another file is not.
- List rendering happens inside the surface part, where it belongs:

  ```tsx
  <SelectContent>
    {currencies.map((currency) => (
      <SelectItem key={currency.code} value={currency.code}>
        {currency.label}
      </SelectItem>
    ))}
  </SelectContent>
  ```

- Conditional parts are fine; conditional *roots* remount and reset uncontrolled state. Keep the root mounted and drive it with props instead.
- Because parts are ordinary components, layout composition (`Stack`, `HStack`, `VStack`, `Box`) works inside them without special cases.

## Common misconception

> "These are just wrapper divs, so I can move them around freely."

They are not structural — they are context consumers with behavior attached. The most common failure is a "reusable trigger" abstraction that separates a trigger from its content: nothing type-checks as broken, the button renders, and then the overlay positions against the window instead of the anchor, or `Escape` closes the wrong layer. Keep the family together and pass configuration through props.

The second most common failure is re-implementing a part. If `SelectItem` does not do what you need, put your content inside it rather than writing a substitute — the accessibility semantics and selection reporting live in the part you replaced.

## Where to go next

- [State model](/docs/learn/state-model/) — controlled and uncontrolled roots.
- [Forms model](/docs/learn/forms-model/) — `Field` as a composition boundary.
- [Overlays & runtime ownership](/docs/learn/overlays-and-runtime/) — what `SelectContent` mounts into.
- [Components](/docs/components/) — the exact parts, props and types for each family.
- [Patterns](/docs/patterns/) — full screens built out of these families.

## Source authority

- [`packages/ui/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/index.ts) — the complete public part list.
- [`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md) — the canonical component behavior catalog.
