# BeeUI token lifecycle and deprecation policy

This document defines how BeeUI marks the maturity of public design tokens, how a token is deprecated and eventually removed, and what compatibility a consumer can rely on during BeeUI's current pre-1.0 stage. Lifecycle metadata is part of the canonical token model in `packages/tokens/tokens.json`; there is no separate hand-maintained deprecation registry, and the generated artifacts are derived from that metadata.

## Current stability posture

BeeUI packages are `0.x` and `private: true`. This is a pre-1.0 project: the token vocabulary is stabilizing but not frozen, and BeeUI does not claim full semantic-versioning stability or a "never breaking" guarantee. The lifecycle contract exists to make the changes that do happen legible and mechanically checkable, not to promise permanence the project has not adopted.

The canonical source records this posture under `$extensions["com.beeui"].lifecyclePolicy` (package version, `pre-1.0` stability, default status, status vocabulary, minimum compatibility window, and governed scope).

## What is a public token

Governed public tokens are:

- the public foundation scale groups exposed to consumers — `spacing`, `radius`, `fontFamily`, `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`, `controlSize`, `iconSize`, `avatarSize`, `contentWidth`, `elevation`, `motionDuration`, `motionEasing`;
- the semantic color tokens (the `semanticColorDescriptions` vocabulary), which are the primary governance target because applications theme against them.

Internal representation details (raw DTCG keys behind a `publicName`, per-theme color storage, native/CSS serialization metadata) are not independently governed. `focusRing` is a compound cross-platform contract rather than an individual token scale and is not lifecycle-annotated per sub-token.

## Status vocabulary

Every governed token resolves to exactly one status from the smallest useful set:

- **stable** — the current default. Part of the public contract; changed only through the deprecation path below.
- **experimental** — available but may change or be removed with lighter notice. Consumers adopt it knowing the contract is not settled.
- **deprecated** — still generated for compatibility, but consumers should migrate to the declared replacement where one exists. A deprecated token is on a path to removal.

Tokens with no explicit annotation inherit `lifecyclePolicy.defaultStatus` (currently **stable**), so existing tokens need not be individually annotated to be governed. Changing the policy default changes the classification of unannotated governed tokens; codegen and the lifecycle manifest use the same canonical value.

## Two kinds of alias (kept distinct)

- **Authoring alias** — `$extensions["com.beeui"].publicName`, e.g. the DTCG-legal key `2-5` exposed publicly as `2.5`. This has **no** deprecation meaning; it only bridges the DTCG naming grammar and the public API.
- **Deprecated-compatibility alias** — a token whose status is `deprecated` and that keeps generating during its compatibility window. In the machine manifest these carry `aliasKind: "deprecated-compatibility"`.

The two are never conflated in metadata or generated output.

## How to deprecate a token

Deprecation is authored on the canonical token, never in a side list.

For a **foundation** token, annotate the token node:

```jsonc
"xs": {
  "$value": { "value": 4, "unit": "px" },
  "$deprecated": "Renamed for scale clarity.",          // standard DTCG field (optional but recommended)
  "$extensions": {
    "com.beeui": {
      "lifecycle": {
        "status": "deprecated",
        "since": "0.1.0",
        "reason": "Renamed for scale clarity.",
        "replacement": "radius.sm",                       // <category>.<publicName>
        "removal": { "target": "0.2.0" }                  // optional removal target
      }
    }
  }
}
```

For a **semantic color**, annotate `$extensions["com.beeui"].semanticColorLifecycle` (co-located with `semanticColorDescriptions`), keyed by the semantic token name, using the same lifecycle shape with a `color.<name>` replacement path.

The standard DTCG `$deprecated` field (boolean or string) is honored so generic DTCG tooling sees the deprecation too. When both `$deprecated` and the extension are present they must agree in both directions: `$deprecated: true`/a string requires BeeUI status `deprecated`, while `$deprecated: false` cannot coexist with BeeUI status `deprecated`. The generator rejects contradictions.

### Specifying replacement and removal target

- `replacement` is an optional `<category>.<publicName>` path (e.g. `spacing.4`, `radius.sm`, `color.surface`). Omit it only for a true pure-removal deprecation with no successor.
- `removal.target` is an optional version/wave at which the token may be removed once policy is satisfied.
- `removal.migrationEvidence` may record a link/summary of migration proof.

Validation (run as part of `pnpm tokens:check` / `pnpm tokens:test`) enforces:

1. a deprecated token declares a non-empty `reason`;
2. when a replacement is declared, it exists and is a governed public token;
3. the replacement is in the **same category** as the deprecated token;
4. a token cannot be deprecated in favor of **itself**;
5. a declared replacement must point **directly at a live (non-deprecated) token**. Pointing a replacement at another deprecated token is a hard error, whether that target is a dead-end (no onward replacement) or would eventually resolve through further deprecated hops. BeeUI pre-1.0 does not support staged migrations through deprecated tokens; each replacement names a currently-live target. Replacement graphs must not cycle.

A token may be deprecated with **no** replacement (a pure-removal deprecation). It can still be removed after the same target, migration-evidence, and compatibility-window checks; only replacement validation is skipped.

## Compatibility alias behavior in TS and CSS

A deprecated token remains generated until an actual removal passes the policy gate. `compatibilityAlias` does **not** remove the deprecated public token early.

- **TypeScript** — the token keeps its key in the generated object and gains an `@deprecated` JSDoc annotation with replacement guidance when a replacement exists. The key remains present throughout the compatibility window.
- **CSS** — for a deprecated semantic color with a replacement, `compatibilityAlias: true` (the default) emits `--color-<old>: var(--color-<replacement>)` with a deprecation comment. Setting it to `false` means the old variable keeps its authored literal during the window instead of pointing at the replacement; it still remains generated. Foundation-scale values likewise remain emitted while deprecated.

This makes the boolean's meaning precise: it controls replacement-alias serialization, not whether the public token exists.

## Machine-readable lifecycle metadata and migration report

- `packages/tokens/src/lifecycle.json` is generated from canonical metadata. It reports the version/stability posture, the status vocabulary, the alias-kind distinction, a summary count by status, and the list of non-stable tokens (with replacement and removal target for deprecated ones). It is exported as `@beeui/tokens/lifecycle.json`.
- `pnpm tokens:migration-report` prints a deterministic Markdown migration/deprecation report from the same canonical metadata (use `--out <file>` to write it). It is generated, never hand-maintained, so release notes cannot drift from the source.

## Minimum compatibility window (pre-1.0)

A deprecated public token is kept for **at least one subsequent pre-1.0 minor release** before it is removed. Experimental tokens carry no window guarantee. These windows are pre-1.0 conveniences, not a 1.0 semver promise.

## When breaking removals are allowed, and when an alias may finally be removed

`pnpm tokens:check` includes `scripts/check-token-removals.mjs`. In pull-request CI it uses GitHub's `GITHUB_BASE_REF` plus the full git history already provided by `actions/checkout` to find the exact merge base, loads the canonical token source at that base with `git show`, and compares the governed public token set to the head. This is important because a token cannot prove its own removal after its node has disappeared from the current source.

The baseline-aware check rejects direct removal of stable public tokens. A deprecated token may be removed only when all of the following hold (via `assertRemovalAllowed` against the **pre-removal** source):

- the token is actually `deprecated`;
- a `removal.target` is declared;
- if a `replacement` is declared, it resolves cleanly and remains a live governed token in the head;
- migration evidence exists (`removal.migrationEvidence` or an explicit evidence flag);
- the compatibility window is satisfied (the current version is at or past the removal target and at least one minor past `since`, or `removal.compatibilitySatisfied` is explicitly set for wave-based schedules).

A pure-removal deprecation follows the same gate without a replacement requirement. Experimental tokens may be removed with lighter notice. Outside these conditions `tokens:check` fails in PR CI.

## Contributor / reviewer checklist for token removal

- [ ] The token has been `deprecated` (not removed directly) for the required window, unless it is explicitly `experimental`.
- [ ] If migration has a successor, a valid same-category live `replacement` is declared and remains present in the head.
- [ ] `removal.target` is set and reached; migration evidence is recorded.
- [ ] `pnpm tokens:check`, `pnpm tokens:test`, and `pnpm tokens:migration-report` reflect the change.
- [ ] The CHANGELOG records the removal for consumers.

## Interaction with the DTCG export (#80/#69)

Lifecycle metadata rides the existing DTCG 2025.10 model: the standard `$deprecated` field carries the deprecation signal for generic tooling, and richer lifecycle data lives under the documented `com.beeui` extension inside the same DTCG document. No separate export path is introduced; `lifecycle.json` is the derived machine projection for consumers that do not parse the full DTCG source.

## Consumer example — editor/TypeScript deprecation guidance

When a token is deprecated, a consumer importing it sees the guidance directly:

```ts
import { radius } from '@beeui/tokens';

// Editor shows: (property) "xs": number  — @deprecated Use `radius.sm`. Renamed for scale clarity.
const r = radius['xs']; // strikethrough + tsserver deprecation hint
```

## Deferred integration: semantic-consumption guardrail (#83)

The lifecycle manifest is the intended data source for a future semantic-consumption guardrail (#83) that would prevent new reusable component code from adopting a deprecated token when a replacement exists. That guardrail is **not** implemented here. This work only exposes the consumable metadata — `lifecycle.json` (deprecated token → replacement, `aliasKind`) plus `buildLifecycleManifest` / `collectGovernedTokens` in `scripts/token-lifecycle.mjs` — so #83 can consume generated lifecycle data rather than maintaining its own list.
