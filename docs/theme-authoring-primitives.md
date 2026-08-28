# Private authoring primitives and semantic aliases

BeeUI keeps two distinct token layers in `packages/tokens/tokens.json`:

- **Public semantic tokens** — the reusable component contract (`primary`, `destructive`, `control-border`, `focus-ring`, …). Components and reusable `@beeui/ui` source consume only these.
- **Private authoring primitives** — reusable brand/neutral palette values that theme authors and the generator use to keep repeated colors governed in one place. They are **not** a component API.

Semantic tokens may *alias* primitives with standard DTCG references. The generator resolves those references deterministically, so every generated artifact still contains concrete runtime values.

```text
PRIVATE AUTHORING PRIMITIVES  (packages/tokens/tokens.json #/primitives)
        |  DTCG $ref alias
PUBLIC SEMANTIC THEME TOKENS  (#/themes/<runtime>/colors)
        |  deterministic resolution (scripts/generate-tokens.mjs)
TS + CSS + resolver artifacts (packages/tokens/src/*)
        |
brand-blind BeeUI components
```

## Where primitives live and how they are classified

Primitives live in the top-level `primitives` group of the canonical document. The group is classified authoring-only:

```jsonc
"primitives": {
  "$type": "color",
  "$extensions": { "com.beeui": { "visibility": "private" } },
  "danger": {
    "default": { "$value": { "colorSpace": "srgb", "components": [...], "hex": "#dc2626" } }
  }
}
```

A single machine-readable pointer records the private layer so later tooling (issue #83 enforcement, issue #80 DTCG export) needs no second hand-maintained list:

```json
"$extensions": { "com.beeui": { "privateTokenGroups": ["primitives"] } }
```

Primitive families are functional/authoring-oriented (`common`, `neutral`, `amber`, `violet`, `danger`, `feedback`) and are deliberately **not** exposed as component styling names.

## Alias versus direct semantic literal

Create a primitive and alias to it only when a value shows **real reuse** across runtime themes or brands. Two clear cases in the current themes:

- `destructive` is brand-independent: Bee and Violet share the same danger scale, so both brands' `destructive*` roles alias `#/primitives/danger/*`.
- The dark feedback fills (`success`, `info`, and their foregrounds) are shared between `dark` and `violet-dark`, so they alias `#/primitives/feedback/*`.

Keep a **direct semantic literal** when an alias would add no reusable meaning:

- single-use values (for example `dark.surface`);
- values that only coincide within one runtime theme;
- `control-border` (the #66 boundary contract) and `overlay` (per-theme scrim alpha) are authored explicitly per runtime theme and are never aliased.

Do **not** mass-replace every literal with a primitive, and do not create a full palette scale for every hex. Reuse evidence is the bar.

## Authoring a semantic alias

Reference a primitive with a same-document JSON Pointer in the token's `$ref` (the DTCG 2025.10 Format reference form). A `$description` may stay alongside the reference; `$value` and `$ref` are mutually exclusive.

```jsonc
"destructive": {
  "$description": "Destructive action or invalid boundary.",
  "$ref": "#/primitives/danger/default"
}
```

## Adding a new primitive

1. Confirm the value is reused (or will be reused) across themes/brands.
2. Add it under the correct `primitives.<family>` group with a standard DTCG color value (matching `colorSpace`, `components`, and six-digit `hex`).
3. Point the relevant semantic tokens at it with `$ref`.
4. Regenerate and verify (below). Keep the family name functional; never introduce a component styling name.

## How references are validated and resolved

`scripts/generate-tokens.mjs` validates the raw reference graph, then resolves it into an in-memory document that the artifacts are rendered from. The following are rejected deterministically:

- **dangling references** — a `$ref` whose target does not exist;
- **cycles**, including multi-node cycles (`a -> b -> c -> a`);
- **cross-category references** — a color token may not alias a dimension token, etc.;
- **references that escape the private layer** — semantic tokens may only alias `#/primitives/*`, never other semantic tokens.

Multi-hop aliasing (a primitive that references another primitive) is supported and resolves to the base value, provided the chain stays acyclic.

Because references are resolved before rendering, generated `theme.css` and `index.ts` contain resolved runtime values and never an unresolved `#/primitives/...` reference. Changing one primitive propagates to every semantic token that aliases it.

## Custom brands

A custom brand should extend the **authoring primitive** layer and alias semantic roles to it. Components stay palette-blind: they keep consuming semantic names such as `bg-primary` or `text-destructive-foreground`, so adding a brand never makes component source aware of a palette.

## Verify

```sh
pnpm tokens:generate   # regenerate artifacts from the canonical source
pnpm tokens:check      # read-only staleness gate
pnpm tokens:test       # resolution, cycle/dangling/cross-category, parity, leakage guard
pnpm typecheck
pnpm test
```

Reusable-component leakage is guarded by a representative static check that `@beeui/ui` source consumes no private primitive identifier. Issue #83 will own the general enforcement rule; issue #80 will handle DTCG export/interoperability. This document covers only the private-primitive → semantic-alias authoring contract.
