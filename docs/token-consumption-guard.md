# Semantic-token consumption guard

BeeUI's design rule is that reusable component source consumes public semantic tokens —
never raw color literals, private authoring primitives, unsupported raw CSS-variable
access, or brand-specific literals/branches (see [`theming.md`](./theming.md) and
[`theme-authoring-primitives.md`](./theme-authoring-primitives.md)). Until issue #83 that
rule was documentation only. `scripts/check-semantic-token-consumption.mjs` makes it
mechanically enforceable for `packages/ui/src/**`.

## Run it locally

```sh
pnpm tokens:consumption-check   # the guard itself (fails on real violations)
pnpm tokens:test                # includes the guard's own fixture test suite
```

It runs deterministically and offline (no network access, no compiler, plain text/regex
scanning of `.ts`/`.tsx` files) and never rewrites source.

## Where it runs in CI

`pnpm tokens:consumption-check` is chained into `pnpm typecheck`
(`hygiene:check && tokens:check && tokens:consumption-check && ...`), which CI runs before
`pnpm test` and `pnpm release:verify`. It is an early deterministic gate, not a release-time
check.

## Scope

Only `packages/ui/src/**` is scanned — BeeUI's reusable component library. Nothing else in
the monorepo is in scope:

- `apps/showcase/patterns/**` (the production Pattern Gallery) is product-specific content,
  not reusable library code, and is explicitly out of scope for #83;
- `packages/core` and `packages/tokens` are not component styling surfaces;
- within `packages/ui/src`, generated `.d.ts` files, `__tests__`/`__fixtures__`/`__mocks__`
  directories, and `*.test.ts(x)`/`*.spec.ts(x)`/`*.stories.ts(x)` files are excluded — they
  are tests, fixtures, or docs, not the shipped contract.

## What is classified as public vs. private, and how

The guard never hand-maintains a second token list. It derives classification from the
same canonical/generated metadata every run, via helpers exported from
`scripts/generate-tokens.mjs`:

- **public semantic color names** — `semanticNames(source)`, reading
  `$extensions["com.beeui"].semanticColorDescriptions` in `packages/tokens/tokens.json`.
  This is the exact metadata that generates `semanticColorTokens` in
  `packages/tokens/src/index.ts`.
- **private authoring-primitive identifiers** — `privatePrimitiveIdentifiers(source)`,
  which walks every group named in `$extensions["com.beeui"].privateTokenGroups` (currently
  just `primitives`) and flattens each family/leaf into the styling-name shapes a component
  could reference (`neutral`, `neutral-500`, `danger-emphasis`, …).
- **brand names** — `brandNames(source)`, reading `$extensions["com.beeui"].brandNames`.
- **runtime-readable CSS-variable namespaces** — `readableTokenNamespaces(source)` /
  `readableVariablePrefixes(source)`, reading the exact same canonical
  `$extensions["com.beeui"].runtimeOverridable` flags (plus the two always-present color
  categories) that build `beeTokenReaderCategories`/`useBeeToken`/`getBeeToken` (#72) in
  `packages/tokens/src/index.ts`. Currently `--color-`, `--chart-`, `--radius-`, and
  `--motion-duration-` — every namespace that has a typed reader path.

Add, rename, or reclassify a token in `packages/tokens/tokens.json` and the guard's rules
change on the next run — nothing in `scripts/check-semantic-token-consumption.mjs` needs
editing.

## What it flags

| Rule | Flags | Why |
| --- | --- | --- |
| `raw-hex-color` | `#fff`, `#ff00ff`, `#ff00ff80`, … | Hard-coded color instead of a semantic token. |
| `raw-rgb-hsl-color` | `rgb(`, `rgba(`, `hsl(`, `hsla(` | Same, via a color function instead of a hex literal. |
| `private-primitive-utility` | `bg-neutral-500`, `text-danger-emphasis`, … | Consumes an authoring-only primitive directly (see `theme-authoring-primitives.md`). |
| `private-primitive-pointer` | `#/primitives/...`, `primitives.foo` | Reaches into the private layer's own reference syntax. |
| `palette-scale-utility` | `bg-sky-500`, `border-red-600`, … | A raw numbered color-scale utility. No BeeUI public semantic color token ever ends in a bare numeric shade, so this pattern is always either Tailwind's built-in default palette or an authoring primitive — never the semantic contract. |
| `raw-css-variable-access` | `var(--color-primary)`, `var(--chart-series-1)`, `var(--radius-md)`, `var(--motion-duration-normal)` | A typed path already exists for every runtime-readable namespace (`useBeeToken`/`getBeeToken`, the generated Tailwind semantic utility class for colors, or a `*Variable()` string helper from `@beemvp/beeui-tokens`); the raw CSS custom property should not be spelled out in component source. A `var(--...)` access to a namespace with **no** typed reader (e.g. `--layer-*`, `--z-*`) is not flagged — only namespaces present in `readableTokenNamespaces()` are. |
| `typed-reader-bypass-call` | `useCSSVariable('--color-primary')`, `Uniwind.getCSSVariable('--radius-md')` | Calling Uniwind's raw CSS-variable read API directly with a readable-namespace variable name bypasses the typed `useBeeToken`/`getBeeToken` adapter the same way `var(--color-*)` does. Exempted only for the adapter's own sanctioned implementation file, `packages/ui/src/components/use-bee-token.ts` — matched by exact relative file path, never a directory-level ignore; every other file in scope, including siblings in the same directory, is still checked. |
| `brand-literal-branch` | `brand === 'violet'` | Reusable components stay brand-blind; branching on a brand name bypasses the semantic/theme mapping. |

It does **not** ban numeric literals, spacing/sizing utilities, or content strings — `px-4`,
`gap-2`, `z-50`, `"Order #12345"`, and similar never match any rule. It also does not ban
`var(--...)`/`useCSSVariable(...)` access to a CSS-variable namespace that has no typed
reader (e.g. `--layer-*`) — only namespaces with a real `useBeeToken`/`getBeeToken` path are
in scope for these two rules.

### Allowed vs. rejected examples

```tsx
// Allowed — public semantic tokens
<Pressable className="border-primary bg-primary active:bg-primary-pressed" />
<Text className="text-destructive-foreground" />

// Rejected — private primitive
<Pressable className="bg-neutral-500" />

// Rejected — raw literal
<View style={{ backgroundColor: '#f59e0b' }} />

// Rejected — raw CSS-variable access to a readable namespace
const stroke = { color: 'var(--chart-series-1)' };

// Rejected — bypasses the typed reader via Uniwind's raw read API directly
const radius = useCSSVariable('--radius-md');

// Allowed — the typed #72 reader
const radius = useBeeToken('radius.md');

// Rejected — brand branch in reusable component source
if (brand === 'violet') return <VioletOnlyIcon />;
```

## Exception syntax

A narrow, reviewable escape hatch exists for genuine non-semantic cases (a platform/browser
bug, a third-party SDK's fixed brand color, a protocol value that is not a design-system
color). Add a trailing line comment on the **same line** as the flagged code:

```ts
const iosStatusBarFix = '#000000'; // beeui-token-guard-allow: iOS 17 status bar rendering bug, tracked in #123
```

Requirements:

- the marker is exactly `beeui-token-guard-allow:` followed by a rationale;
- the rationale must be a real explanation — at least 12 characters after trimming. A blank
  or too-short rationale fails the guard (as its own `blank-exception-rationale` violation)
  **and** the underlying violation on that line still fails, so a bare marker never quietly
  suppresses anything;
- it is per-line only — there is no file-level or directory-level ignore mechanism, so an
  exception can never turn into a broad exclusion.

Use an exception only when a semantic token genuinely does not apply. If a color or value is
reused, or represents a real design decision, add a semantic token to
`packages/tokens/tokens.json` instead — that is the normal, always-easiest path, not the
exception path.

## Adding a new semantic token

If a component needs a color that no existing semantic token expresses, do not reach for a
private primitive or a literal. Add (or alias) a token in `packages/tokens/tokens.json`
following [`theme-authoring-primitives.md`](./theme-authoring-primitives.md), then run
`pnpm tokens:generate` and `pnpm tokens:check`. The guard's public allow-list — and every
generated artifact — updates automatically.

## Tests

`scripts/__tests__/check-semantic-token-consumption.test.mjs` covers every rule
(positive and negative fixtures), the exception model (valid, blank, and too-short
rationale), file-collection exclusions, that classification tracks canonical metadata
changes — including flipping a token group's `runtimeOverridable` flag on or off and
confirming the `raw-css-variable-access`/`typed-reader-bypass-call` rules follow — the
exact-file-path exemption for `packages/ui/src/components/use-bee-token.ts` (and that a
sibling file in the same directory is still checked), and that the real `packages/ui/src`
tree currently passes with zero violations and no broad ignore list.
