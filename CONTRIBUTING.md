# Contributing to BeeUI

BeeUI is developed under an explicit execution contract designed so that both human
contributors and coding agents (Claude, Codex, etc.) can produce correctly scoped,
independently reviewable pull requests without private context. Read this file before
opening a PR — it is the public counterpart to
[`docs/agent-execution-contract.md`](docs/agent-execution-contract.md), which remains the
authoritative protocol for BeeUI 1.0 program work.

If anything here conflicts with an assigned GitHub issue or with
`docs/agent-execution-contract.md`, stop and ask/report the conflict instead of guessing.

## Before you start

Read, in order:

1. the GitHub issue you intend to work on, including its Definition of Done;
2. parent tracker [#114](https://github.com/beobungbu/BeeUI/issues/114) for current program
   state and owner-locked gates;
3. [`docs/roadmap.md`](docs/roadmap.md) — product scope and issue map;
4. [`docs/architecture.md`](docs/architecture.md) — the invariants this file summarizes;
5. [`docs/agent-execution-contract.md`](docs/agent-execution-contract.md) — mandatory
   startup/scope/self-test/self-review/PR-handoff protocol;
6. any ADR under [`docs/decisions/`](docs/decisions/) directly relevant to the component or
   subsystem you are touching.

**Issue number is not execution order.** Use
[`docs/beeui-1.0-sequence.md`](docs/beeui-1.0-sequence.md) for dependency/eligibility order.

The license for this repository is intentionally not yet chosen (owner-gated, tracked in
issue #188) and this repository remains **private**. Do not assume a license, do not make
the repository public, and do not publish packages/CLI/releases — those are owner actions
(see "Owner-gated actions" below).

## Local setup

Requirements: Node `24.13.1` (see [`.nvmrc`](.nvmrc)) and `pnpm` via Corepack.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm showcase
```

Then press `i` (iOS), `a` (Android), or `w` (Web) in the Expo terminal.

### Required gates before opening a PR

```bash
pnpm typecheck   # hygiene + token + compatibility + workspace typecheck
pnpm test        # token/compat/bench unit tests + showcase tests + registry verify/test
pnpm check       # typecheck && test
```

Run these two when your change touches the relevant surface:

```bash
pnpm registry:verify   # public component barrel <-> registry/registry.json parity
pnpm release:verify    # package export/manifest/clean-consumer verification
```

`pnpm typecheck` already includes `pnpm hygiene:check`
(`scripts/check-repo-hygiene.mjs`) and token/compatibility guards — do not skip it in favor
of a narrower `tsc` invocation. `git diff --check` must also be clean (no trailing
whitespace / whitespace-only conflicts) before you open a PR.

Some gates only apply to native-sensitive changes (Android/iOS compile, native runtime
smoke via Maestro, packed-artifact/clean-consumer checks). See "Expected tests and
evidence" below for when they are required, and
[`docs/beeui-1.0-evidence-classes.md`](docs/beeui-1.0-evidence-classes.md) for how to
describe what you actually ran.

## Architecture invariants

These are established BeeUI decisions. Do not silently change them; if you believe one is
wrong, open an issue proposing the change instead of reversing it inside an unrelated PR.

- **Semantic tokens, brand-blind components.** Reusable components consume the generated
  semantic token layer (`useBeeToken`/`getBeeToken`, generated Tailwind semantic utility
  classes, `@beemvp/beeui-tokens` variable helpers) — never raw hex/brand literals, raw
  `var(--color-*)` CSS custom properties for a namespace that already has a typed reader,
  or branching on a brand name (`brand === 'violet'`). `pnpm tokens:consumption-check`
  enforces this; see [`docs/token-consumption-guard.md`](docs/token-consumption-guard.md)
  for the exact rule table and exemptions.
- **Rule of Two.** Compose existing primitives first; keep domain-specific composition
  local to the app/pattern. Only promote something to a new public BeeUI primitive after
  repeated or behaviorally complex evidence justifies a stable contract — see
  [`docs/components.md`](docs/components.md).
- **Issue before primitive.** A new public component/primitive is proposed via a GitHub
  issue (Rule-of-Two justification, contract sketch, platform scope) before implementation
  starts, not invented inline inside an unrelated PR. Use the "Reusable component / gap
  proposal" issue template.
- **No duplicate runtime authority.** One theme engine, one overlay/portal runtime, one
  focus/dismiss stack, one direction resolver (`useDirection()`), one global state engine.
  New anchored-overlay-geometry work reuses the existing `@beemvp/beeui-core` resolver and
  `overlay-runtime.tsx`, it does not reinvent them (ADR-002, ADR-004).
- **Controlled-only where established.** `Checkbox`, `Radio`, `RadioGroup`, `Switch`,
  `Tabs`, `SegmentedControl`, `Pagination`, and similar do not invent hidden uncontrolled
  state. Controlled/uncontrolled contracts must handle delayed parent updates and cleanup
  deterministically.
- **Platform-honest, contract-coherent.** Web and native implementations may differ
  (e.g. `overlay-transport.web.tsx` / `overlay-transport.native.tsx`) when the divergence
  is structural, but the public contract and accessibility semantics must stay coherent
  across platforms, and the difference must be intentional and documented, not accidental.
- **Ownership boundaries stay outside BeeUI.** Routing, data fetching, backend/auth,
  payments, and form-library ownership remain the consuming application's responsibility
  unless an issue explicitly changes that boundary.
- **Accessibility is correctness, not a follow-up.** RTL/logical direction, Dynamic
  Type/large text, high contrast, and reduced motion are part of the component contract,
  not optional polish.
- **Release-ready is not released.** Packages/CLI may be packed, dry-run, and verified in
  clean consumers, but publication (`npm publish`, stable dist-tags, the `v1.0.0` tag,
  making the repository public) is owner-gated — see
  [`docs/agent-execution-contract.md`](docs/agent-execution-contract.md) and
  [`docs/beeui-1.0-owner-gates.md`](docs/beeui-1.0-owner-gates.md).

### Working with the Table, Calendar, Sheet, and Tooltip contracts

These four surfaces each have an accepted architecture ADR that governs how you may extend
or consume them. Read the relevant ADR before touching the component:

- **Table/DataTable** — [ADR-007](docs/decisions/007-table-datatable-architecture.md):
  compositional primitives the caller assembles (no `data`/`columns` array owned
  internally), controlled-only state, density as a shared token axis, `useDirection()`
  reused rather than reinvented.
- **Calendar/DatePicker/DateTimePicker** — [ADR-008](docs/decisions/008-datetime-architecture.md):
  locked architecture for date/time components; do not introduce a second date library or
  a competing date-math utility without updating the ADR first.
- **Sheet/BottomSheet** — [ADR-006](docs/decisions/006-sheet-gesture-engine.md): fixes the
  gesture-physics dependency strategy; do not add a second gesture/animation dependency for
  sheet-like behavior.
- **Tooltip** — [ADR-005](docs/decisions/005-tooltip-contract.md): Tooltip has its own
  semantic contract; it is not a visual alias of `DropdownMenu`/`Popover` even though it
  shares the anchored-overlay geometry/runtime kernel.

Changes to any of these that would contradict the accepted ADR require a new/updated ADR
first, not an inline reinterpretation.

## Expected tests and evidence

New logic needs load-bearing tests: a test that does not fail when the fix/contract is
reverted or bypassed does not satisfy this requirement. Snapshot-only, mock-only, or
type-compilation-only tests are not sufficient when the reported risk is runtime/interaction
behavior.

Match your evidence class to what the change actually touches
([`docs/beeui-1.0-evidence-classes.md`](docs/beeui-1.0-evidence-classes.md) defines each
term precisely — always state the strongest evidence class you actually obtained, never the
one you wish you had):

| Change touches | Minimum evidence |
| --- | --- |
| Component logic/contract (any platform) | Deterministic unit/component tests (Jest + RNTL) |
| Web interactive behavior (keyboard/pointer/focus) | Browser interaction evidence (Playwright) via `apps/visual-regression` |
| Rendered visual output | Visual evidence (screenshot comparison) — see [`docs/visual-regression.md`](docs/visual-regression.md) |
| Native-sensitive code (gesture, keyboard, Back, measurement, presentation) | Native compile **and** real Simulator/Emulator runtime evidence — see [`docs/native-runtime-smoke.md`](docs/native-runtime-smoke.md) and [`docs/native-verification.md`](docs/native-verification.md) |
| Assistive-technology-required issue | VoiceOver/TalkBack or supported automated evidence, named explicitly as such |
| Performance-budgeted path | `pnpm bench` harness output with environment/sample metadata — see [`docs/benchmark-harness.md`](docs/benchmark-harness.md) |
| Public package/CLI surface | Packed/clean-consumer verification via `pnpm release:verify` |

Do not describe simulator/emulator evidence as physical-device evidence, and do not
describe a passing type-check as proof of runtime correctness.

## Registry and CLI expectations

Adding, removing, or renaming a public component in `packages/ui/src/index.ts` requires a
matching update to `registry/registry.json` (`pnpm registry:verify` fails CI otherwise —
see [`docs/registry-cli.md`](docs/registry-cli.md)). If your change introduces a new
transitive/internal registry dependency (a shared helper multiple public components need),
follow the existing pattern (`core-cn`, `field-context`, `overlay-runtime`, etc.) instead of
inlining the helper into every consumer.

## Public documentation surfaces

Every public symbol, token, CLI command, package export subpath and Registry item is derived
into `docs/public-surface.inventory.json` and must be owned by a **published** documentation
page. `pnpm docs:surface:check` (part of `pnpm typecheck`) fails otherwise, so adding one
export to a public barrel is a documentation change as well as a code change.

The gate reads two things you can change by hand — `docs/public-surface-owners.json` (which
route owns which surface) and the curated prose files (`docs/reference.content.json`,
`docs/component-reference.content.json`, `docs/pattern-library.content.json`) — and one thing
you must never hand-edit: the inventory itself, and every page generated from it.

When you add, rename or remove a public surface:

```bash
pnpm docs:surface:generate      # re-derive the inventory from source
git diff docs/public-surface.inventory.json   # read the derived surface/owner diff
pnpm docs:reference:generate    # rewrite the generated Reference pages
pnpm docs:surface:acknowledge   # last: record that you reviewed the diff
pnpm docs:surface:check         # must pass before you open the PR
```

Two things about that sequence are easy to get wrong.

**`pnpm docs:surface:acknowledge` is not the fix for the error it silences.** The gate hashes
each canonical source file, so editing `packages/ui/src/index.ts` produces:

```text
packages/ui/src/index.ts changed after documentation ownership was acknowledged
(8bc4dd7… -> 7cb3e61…). Review the derived surface/owner diff, update docs as needed,
then intentionally update acknowledgedSourceBlobs.
```

Running `acknowledge` first makes that message go away with the surface still undocumented.
Run it last, as a statement that you read the diff and the docs now cover what changed.

**A new owner route needs prose before it can be published.** If your surface routes to a
Reference owner that has no entry in `docs/reference.content.json`,
`pnpm docs:reference:check` fails rather than publishing a bare table of symbol names. Add
the `title`, `description` and `intro` for that owner.

You do not need to run the component, pattern or portal page generators by hand — `pnpm
docs:build` and `pnpm --filter @beemvp/beeui-docs typecheck` run them first. Those pages are
generated output: fix the generator or the content JSON, never the `.md` file.

## Review discipline

- **Exact-head review.** Reviews (self-review and independent review) are against the exact
  PR head SHA, not an earlier commit. If you push after requesting review, say so and
  identify the new head; a stale-head approval does not carry forward automatically —
  see [`docs/beeui-1.0-integration-discipline.md`](docs/beeui-1.0-integration-discipline.md).
- **Self-review is mandatory but not sufficient.** Every PR needs a self-review pass
  against [`docs/agent-execution-contract.md`](docs/agent-execution-contract.md)'s
  self-review checklist before requesting review, and a separate independent reviewer pass
  before merge — see [`docs/beeui-1.0-review-checklist.md`](docs/beeui-1.0-review-checklist.md).
- **No self-merge.** The implementation agent/author never merges their own PR, merges a
  sibling's PR, or pushes directly to `main`. A different reviewer approves and merges.
  This applies equally to AI-agent-authored patches — an agent may implement, self-test,
  self-review, and open a PR, but merge authority always belongs to a separate reviewer.
- **Shared-authority changes are serialized**, not parallelized: public package barrels,
  the Registry source map, package manifests/export maps, canonical token
  source/generated artifacts, the compatibility matrix, and release workflows. See
  [`docs/beeui-1.0-integration-discipline.md`](docs/beeui-1.0-integration-discipline.md)
  before touching one of these alongside other in-flight work.

## PR contents

Every PR should state, at minimum:

- the issue it resolves (link it) and its scope, including explicit out-of-scope items;
- exact base SHA and exact head SHA;
- test commands run and their result, plus which evidence classes were obtained versus
  skipped (and why a skip is valid for this change);
- accessibility/RTL/large-text/reduced-motion impact, or "not applicable" with reasoning;
- compatibility/platform impact;
- registry/package/docs metadata changes, if any;
- migration/semver impact — update [`CHANGELOG.md`](CHANGELOG.md) under `## Unreleased` for
  any consumer-facing addition or behavior change, and call out breaking changes explicitly;
- an explicit no-self-merge acknowledgement (the PR template includes this checkbox).

Use `.github/PULL_REQUEST_TEMPLATE.md` — it encodes these requirements as checkboxes.

## Owner-gated actions

The following are never autonomous contributor/agent actions, regardless of how ready the
code looks: publishing npm packages or the CLI, creating the `v1.0.0` release/tag, changing
repository visibility, choosing the OSS license (#188), weakening a required CI check to
turn a PR green, and merging your own PR. If your work runs into one of these, stop and
open a decision packet / ask the owner instead of proceeding — see the "Owner-gated
actions" section of
[`docs/agent-execution-contract.md`](docs/agent-execution-contract.md) for the full list.

## Code of conduct

Participation in this project is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Security issues

Do not file a security vulnerability as a public issue. Follow
[`SECURITY.md`](SECURITY.md).
