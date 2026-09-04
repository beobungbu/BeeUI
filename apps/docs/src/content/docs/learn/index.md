---
title: Learn
description: The nine concepts that explain how BeeUI works, so you can predict component behavior instead of looking it up.
---

**Learn** is the concept layer. Each page teaches one rule that explains many components at once, so that you can predict what BeeUI will do rather than discovering it per component.

It is deliberately not the other two layers. [Start](/docs/start/) gets one thing running. [Guides](/docs/guides/) give the shortest correct path to a specific outcome. [Reference](/docs/reference/) holds exact values, props and commands. Learn sits between them and answers *why the API looks like this*.

Every page follows the same shape: the concept in one sentence, why it exists, a diagram or minimal example, the rules that always hold, what that means for your code, the misconception that costs people a day, and where to go next.

## Start here

| Page | The one sentence |
| --- | --- |
| [Foundations](/docs/learn/foundations/) | BeeUI is a mobile-first React Native + TypeScript UI system whose public product is component behavior contracts and semantic tokens — not an application framework. |
| [Ownership model](/docs/learn/ownership-model/) | BeeUI owns component behavior, semantic tokens and the provider runtime; your application owns routing, data, domain state and product policy. |

## How components are built

| Page | The one sentence |
| --- | --- |
| [Composition model](/docs/learn/composition-model/) | A compound component is one root that owns state and context, plus named parts that read it. |
| [State model](/docs/learn/state-model/) | Components hold internal state only for the interaction they own; any value your product cares about is passed in and reported back. |
| [Forms model](/docs/learn/forms-model/) | BeeUI renders `invalid`; it does not decide what invalid means. |
| [Overlays & runtime ownership](/docs/learn/overlays-and-runtime/) | Overlays are clients of two provider-owned runtimes — and those two runtimes nest differently. |

## How BeeUI meets the real world

| Page | The one sentence |
| --- | --- |
| [Cross-platform model](/docs/learn/cross-platform-model/) | Shared source means one API and one contract across Web, iOS and Android — never that evidence transfers between them. |
| [Responsive model](/docs/learn/responsive-model/) | BeeUI is compact-first: extra width is capability your layout opts into, not a different design. |
| [Accessibility model](/docs/learn/accessibility-model/) | A component-level contract plus a deliberate hand-off to the platform — never a certification, and never a substitute for your composition. |

## Suggested reading order

If you are new, read [Foundations](/docs/learn/foundations/) and [Ownership model](/docs/learn/ownership-model/) first — every other page assumes that boundary. After that, follow whichever branch matches what you are building:

```
Foundations ─► Ownership model ─┬─► Composition ─► State ─┬─► Forms
                                │                         └─► Overlays & runtime
                                └─► Cross-platform ─┬─► Responsive
                                                    └─► Accessibility
```

## Related material elsewhere

These pages remain authoritative for their own topics, and the Learn pages link into them rather than restating them:

- [Architecture & design principles](/docs/architecture/) — the condensed architectural summary.
- [Theming](/docs/theming/) — the semantic token contract in practice.
- [Accessibility](/docs/accessibility/) — the executable accessibility task guides.
- [Compatibility](/docs/compatibility/) — the machine-checked version and evidence contract.
- [Responsive & mobile-first](/docs/responsive/) — the short task-level summary.
- [Provider & safe area](/docs/start/provider-safe-area/) — provider setup with a verification checklist.
- [Performance](/docs/performance/) and [Release & security](/docs/release-security/) — operational contracts.

For exact values, symbols, commands and compatibility data, go to [Reference](/docs/reference/) instead.
