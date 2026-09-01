# BeeUI 1.0 token vocabulary freeze (#244, R11.2)

> **Status:** FROZEN. This document declares the immutable BeeUI 1.0 semantic token vocabulary
> — the canonical token categories, names, and lifecycle that are locked for 1.0 — that the RC
> candidate ([#246](https://github.com/beobungbu/BeeUI/issues/246)) is built from. It is
> **documentation-only**: it changes no token source, package, or generated artifact, and it
> publishes nothing.
> **Freeze base commit:** `a1efd48e6b0dbcdb058fe5ed3ffd3328900890dd` (`main`).
> **Snapshot:** 2026-09-02.
> **Canonical source:** `packages/tokens/tokens.json` (DTCG 2025.10 + `com.beeui` extension).
> **Machine projection:** `@beemvp/beeui-tokens/lifecycle.json`.

## What "frozen" means here (and what it does not)

This is the R11 checkpoint that locks the token/lifecycle contract beside the public API freeze
([docs/api-freeze.md](api-freeze.md), #243). The lifecycle *policy* — how tokens are marked,
deprecated, and removed — is [docs/token-lifecycle.md](token-lifecycle.md); this document
freezes the concrete **vocabulary** (the categories and names) and the lifecycle **state** of
that vocabulary at the base commit, records the base commit, and states the un-freeze rule.

**Frozen is not published.** No `@beemvp/beeui-*` artifact exists on npm; every manifest reads
`"version": "0.1.0"` at the freeze base and the `1.0.0` publish is owner-gated at
[#254](https://github.com/beobungbu/BeeUI/issues/254). The generated `lifecycle.json` reports
`"stability": "pre-1.0"` accordingly. Nothing here asserts a published token package.

## Freeze rule (un-freeze requires an explicit semver bump)

Once this vocabulary is frozen, **any change to the governed public token set enumerated below
requires an explicit, documented un-freeze plus a semver bump classified per
[docs/semver-audit.md](semver-audit.md)**, and must pass the lifecycle gate in
[docs/token-lifecycle.md](token-lifecycle.md):

- Removing or renaming a stable public token, or removing one past its deprecation window, is a
  **MAJOR** (`2.0.0`). A stable token is never removed directly — it is first `deprecated`
  (kept generating as a compatibility alias) with a `removal.target`, migration evidence, and a
  satisfied compatibility window, enforced by `scripts/check-token-removals.mjs`.
- Adding a new token, or promoting an `experimental` token to stable, is a **MINOR** (`1.1.0`).
- Value/serialization fixes that keep the token's public name and contract are a **PATCH**.

Experimental tokens keep the lighter-notice policy (no compatibility-window guarantee); at the
freeze base there are **zero** experimental and **zero** deprecated tokens, so the entire
governed set is stable and under the full contract.

## The frozen vocabulary matches the canonical generated artifacts

The vocabulary is not hand-maintained: it is derived from `tokens.json` by
`scripts/generate-tokens.mjs` and guarded so the frozen numbers equal the live surface.
Verified at the freeze base with Node 24.13.1:

| Guard | Command | Asserts | Result at freeze base |
| --- | --- | --- | --- |
| Generated token artifacts + removal baseline | `pnpm tokens:check` | the 4 generated token/lifecycle artifacts are byte-current, and no stable public token was removed without the lifecycle gate | **PASS** — "Token artifacts are current (4 files)" (removal check needs a PR base ref; it runs in PR CI) |
| Semantic-token consumption | `pnpm tokens:consumption-check` | reusable component code consumes the governed semantic vocabulary (no private-primitive leakage) | **PASS** (part of `pnpm typecheck`) |

`pnpm typecheck` (green at the freeze base, Node 24.13.1) runs both `tokens:check` and
`tokens:consumption-check` in its chain.

## Governed public token vocabulary (frozen)

Per [docs/token-lifecycle.md](token-lifecycle.md), the governed public surface is the public
foundation scales plus the semantic color vocabulary; internal representation details (raw DTCG
keys behind a `publicName`, per-theme color storage, native/CSS serialization metadata) are not
independently governed. At the freeze base the generated `lifecycle.json` reports **106 governed
tokens, all `stable`** (0 experimental, 0 deprecated), `defaultStatus: stable`. The frozen
breakdown by category (from `collectGovernedTokens`):

| Category | Frozen count | Category | Frozen count |
| --- | --- | --- | --- |
| `spacing` | 12 | `contentWidth` | 4 |
| `radius` | 7 | `breakpoint` | 2 |
| `fontFamily` | 2 | `pageGutter` | 3 |
| `fontSize` | 6 | `elevation` | 3 |
| `lineHeight` | 6 | `layer` | 3 |
| `fontWeight` | 4 | `motionDuration` | 3 |
| `letterSpacing` | 2 | `motionEasing` | 2 |
| `controlSize` | 5 | **semantic `color`** | **34** |
| `iconSize` | 4 | | |
| `avatarSize` | 4 | **Total governed** | **106** |

The 14 foundation scale groups named in [docs/token-lifecycle.md](token-lifecycle.md) —
`spacing`, `radius`, `fontFamily`, `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`,
`controlSize`, `iconSize`, `avatarSize`, `contentWidth`, `elevation`, `motionDuration`,
`motionEasing` — are governed, plus the responsive-layout (`breakpoint`, `pageGutter`) and
`layer` categories that also carry lifecycle governance. `focusRing` is a compound
cross-platform contract, not a per-sub-token scale, and is not lifecycle-annotated per
sub-token (its contract lives in the accessibility/focus docs).

### The 34 frozen semantic color tokens

The semantic color vocabulary (the `semanticColorDescriptions` set) is the primary governance
target because applications theme against it. Frozen at the base commit:

```
background, border, border-strong, control-border, destructive, destructive-foreground,
destructive-hover, destructive-pressed, disabled, disabled-foreground, focus-ring, foreground,
info, info-foreground, input, muted, muted-foreground, overlay, primary, primary-foreground,
primary-hover, primary-pressed, secondary, secondary-foreground, secondary-hover,
secondary-pressed, subtle-foreground, success, success-foreground, surface, surface-muted,
surface-raised, warning, warning-foreground
```

These are the names consumers key against in `theme.css` / the resolver; each is `stable` and
under the full 1.0 deprecation contract described above. The post-implementation token needs of
the hard components (Tooltip, Sheet, Table, Calendar/date pickers) are already satisfied within
this vocabulary — no new semantic token is introduced at the freeze, and no accepted
production-demo/consumer token finding from [#242](https://github.com/beobungbu/BeeUI/issues/242)
remains unaddressed.

## Frozen lifecycle metadata and machine projection

The frozen contract includes the lifecycle *shape*, not just the names:

- **Status vocabulary:** `stable` (default) · `experimental` · `deprecated`.
- **Alias kinds (kept distinct):** authoring alias (`publicName`, e.g. DTCG key `2-5` exposed
  as `2.5` — no deprecation meaning) vs deprecated-compatibility alias
  (`aliasKind: "deprecated-compatibility"`, generated during a token's compatibility window).
- **Machine-readable subpaths (frozen in [docs/api-freeze.md](api-freeze.md) §1):**
  `@beemvp/beeui-tokens/tokens.json` (canonical DTCG), `./tokens.resolver.json` (resolver
  projection), `./lifecycle.json` (status manifest), `./theme.css` (theme CSS), and the JS
  `./motion-runtime` entry. These are the docs / llms / design-tool interop surface and reflect
  exactly this frozen vocabulary.

`pnpm tokens:migration-report` prints a deterministic Markdown deprecation report from the same
canonical metadata, so release notes cannot drift from the source.

## Post-freeze governance

- A post-freeze semantic-token change is a **release-blocker review**: it is proposed against
  this freeze, classified per [docs/semver-audit.md](semver-audit.md), and (for any
  removal/deprecation) must clear the lifecycle gate in
  [docs/token-lifecycle.md](token-lifecycle.md) with `check-token-removals.mjs` green in PR CI.
- The pre-1.0 "at least one subsequent minor" compatibility window becomes the `1.x`
  deprecation contract once `1.0.0` is cut (see [docs/semver-audit.md](semver-audit.md),
  "Token lifecycle at 1.0").
- No stable token may be introduced, renamed, or removed silently; the generated artifacts and
  guards above are the source of truth for what is frozen.

## Cross-references

- Token lifecycle / deprecation policy: [docs/token-lifecycle.md](token-lifecycle.md)
- Public API freeze (companion checkpoint): [docs/api-freeze.md](api-freeze.md)
- Semver cleanliness audit and level definitions: [docs/semver-audit.md](semver-audit.md)
- Token interop / design-tool surface: [docs/token-interop.md](token-interop.md)
- Semantic-consumption guard: [docs/token-consumption-guard.md](token-consumption-guard.md)
- Owner gate (publish): [docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md),
  [#254](https://github.com/beobungbu/BeeUI/issues/254)
</content>
