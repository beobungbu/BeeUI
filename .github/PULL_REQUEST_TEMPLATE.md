<!--
Read CONTRIBUTING.md and docs/agent-execution-contract.md before filling this out.
Fill in every section; delete only sections that are genuinely not applicable and say why.
-->

## Scope

<!-- One sentence: what does this PR do, and what does it deliberately NOT do? -->

**Issue:** Closes #

**Out of scope (explicit):**
-

## Base / head

- Base SHA: `<exact commit SHA this branch was created from>`
- Head SHA: `<exact commit SHA of this PR as submitted for review>`

## Changes

<!-- Files/areas changed and why. Call out any change to a shared authority
(public package barrels, registry/registry.json, package manifests, canonical token
source, compatibility matrix, release workflows) per
docs/beeui-1.0-integration-discipline.md. -->

## Tests and evidence

<!-- List exact commands run and their result. State the evidence class per
docs/beeui-1.0-evidence-classes.md for each — do not overstate what was actually
observed (e.g. simulator vs. physical device, browser vs. native runtime). -->

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm registry:verify` (required if the public component barrel changed)
- [ ] `pnpm release:verify` (required if package/CLI public surface changed)
- [ ] `git diff --check` clean

| Evidence class | Command / method | Result |
| --- | --- | --- |
| Deterministic contract | | |
| Browser interaction (Web) | | |
| Visual | | |
| Native compile | | |
| Native runtime (Simulator/Emulator/device) | | |
| Assistive technology | | |
| Performance | | |

**Skipped gates and why the skip is valid:**
-

## Accessibility / RTL / large text / reduced motion impact

<!-- State impact explicitly, or "Not applicable" with a one-line reason. -->

## Compatibility / platform impact

<!-- Web / iOS / Android differences introduced or affected. Peer-dependency impact
against docs/compatibility-matrix.md, if any. -->

## Migration / semver impact

<!-- Breaking change? New public API? Update CHANGELOG.md under `## Unreleased` for any
consumer-facing addition or behavior change. -->

- [ ] `CHANGELOG.md` updated, or this PR has no consumer-facing impact.

## Registry / docs / AI metadata

- [ ] `registry/registry.json` updated to match `packages/ui/src/index.ts`, or not applicable.
- [ ] Relevant `docs/*.md` updated, or not applicable.

## Self-review

<!-- Confirm you completed the self-review checklist in
docs/agent-execution-contract.md (scope match, no accidental public API expansion,
controlled/uncontrolled coherence, no duplicate runtime authority, cleanup/races covered,
no private/workspace leakage, file hygiene clean). Note anything you found and fixed. -->

## Remaining risks / limitations

<!-- Anything a reviewer should specifically scrutinize. -->

---

- [ ] **No-self-merge acknowledgement:** I will not merge this PR myself, and I have not
      merged a sibling PR that this depends on. Merge requires a separate reviewer's
      approval and action.

**NOT MERGED — ready for independent review.**
