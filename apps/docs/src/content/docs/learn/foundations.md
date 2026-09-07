---
title: Foundations
description: What BeeUI is, what it deliberately is not, and the layered model every other concept in this section builds on.
---

BeeUI is a mobile-first React Native + TypeScript UI system whose public product is **component behavior contracts and semantic tokens** — not an application framework.

## Why the concept exists

Most UI libraries are read as "a box of widgets". BeeUI is easier to use correctly if you read it as a **contract stack**: a small set of engine-neutral utilities, a semantic token vocabulary, and React Native components that render that vocabulary with a stable behavior and accessibility contract. Everything BeeUI promises lives in those contracts. Everything it does not promise — your router, your data layer, your auth — is left to you on purpose, so that BeeUI can stay upgradable without owning your product decisions.

That framing also explains why BeeUI has two delivery models rather than one. If you consume packages, upgrades are centralized. If you own the source, you trade centralized upgrades for local control. The contract is the same in both; only the update mechanics differ.

## The layer stack

```
your application            routing · data · auth · domain state · analytics
──────────────────────────────────────────────────────────────────────────
Patterns / Demo             composed reference screens — evidence, not a dependency
──────────────────────────────────────────────────────────────────────────
@beemvp/beeui-ui            React Native components: behavior, variants, a11y contract
──────────────────────────────────────────────────────────────────────────
@beemvp/beeui-tokens        semantic color, typography, spacing, density, breakpoints
──────────────────────────────────────────────────────────────────────────
@beemvp/beeui-core          engine-neutral utilities and geometry contracts (cn, dates,
                            anchored-overlay + overlay-runtime primitives)
```

Read the stack downward for authority and upward for composition. A component may depend on tokens and core; nothing in BeeUI depends on your application; and the pattern library sits *above* the component package as reference composition, never as a runtime dependency of your app.

The progression you actually follow when building is the same three steps in the same order:

| Step | You are working with | Where it is documented |
| --- | --- | --- |
| 1. Primitives | `Button`, `Input`, `Text`, `Stack`, `Card` and the rest of the component surface | [Components](/docs/components/) |
| 2. Patterns | composed screens — sign-in, settings, checkout, dashboard | [Patterns](/docs/patterns/) |
| 3. Application | your shell, routes, data and business rules wrapping both | [Ownership model](/docs/learn/ownership-model/) |

## Rules and invariants

1. **The public API stops at the package barrels.** `@beemvp/beeui-ui` is the component surface. Reaching into a component's internal file path is not a supported API, even when it resolves.
2. **Components consume semantic tokens, never brand literals.** A component asks for `background`, `foreground`, `border`, or an intent role; the active theme decides what that means. This is what makes branding and density work without forking component source.
3. **Behavior is contract, styling is variant.** Typed variants (`variant`, `size`, `tone`) are the stable styling surface. `className` is a current-engine escape hatch, not a portability promise.
4. **Mobile-first is the default, not a mode.** BeeUI designs at the narrowest supported width and adds capability as width becomes available. See [Responsive model](/docs/learn/responsive-model/).
5. **Both delivery models preserve the same behavior contract.** Package consumption and source ownership differ in where the code lives and how it is upgraded — not in what a component does.
6. **Evidence classes are not interchangeable.** A type check, a bundle, a browser run and a device run prove four different things. See [Cross-platform model](/docs/learn/cross-platform-model/).

## What BeeUI does not own

BeeUI deliberately ships no router, no data-fetching layer, no form-validation engine, no auth, no analytics and no persistence. It also does not decide which surface of your shell consumes which system inset — that is an explicit caller-owned decision.

This is not a gap waiting to be filled. Each of those systems is a product decision with real lock-in, and a UI system that made the decision for you would either constrain your architecture or drift out of date with the ecosystem it wrapped.

## Distribution reality today

BeeUI's packages are **not published** to the public registry, and the CLI does not resolve from it either. That is a release-authorization state, not a technical-readiness state: everything on this site describes code that exists and is tested in the repository. [Start](/docs/start/) shows the two paths that are executable today — evaluating from the repository, and integrating through real packed tarballs.

## Common misconception

> "BeeUI is the app framework — if it does not include routing and forms, it is incomplete."

BeeUI is the *presentation and interaction* layer. Judging it by framework criteria leads to the anti-pattern of wrapping every BeeUI component in a house component "just in case", which duplicates the contract, hides the upgrade path, and makes the component reference useless to your own team. Compose BeeUI components directly; add a wrapper only when it encodes a genuine product rule.

## Where to go next

- [Ownership model](/docs/learn/ownership-model/) — the boundary line, drawn explicitly.
- [Composition model](/docs/learn/composition-model/) — how compound components fit together.
- [Architecture & design principles](/docs/architecture/) — the shorter architectural summary.
- [Theming](/docs/theming/) — the semantic token contract in practice.
- [Start](/docs/start/) — get something running.
- [Reference](/docs/reference/) — exact values, symbols and commands.

## Source authority

- [`docs/architecture.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/architecture.md) — the layer and boundary contract.
- [`docs/decisions/011-distribution-architecture.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md) — package boundary vs source ownership.
- [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md) — why readiness is not authorization.
