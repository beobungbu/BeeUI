# BeeUI demo & consumer feedback classification (#242, R10.13)

> **Status:** Pre-1.0 (R11.1 API-freeze) triage — the single place every material
> finding from the production demo, the AI-agent reference app, and the consumer
> starters is categorized, severity-rated, and given a disposition before the freeze.
> **Snapshot:** 2026-09-02
> **Parent:** [#114](https://github.com/beobungbu/BeeUI/issues/114) · depends on
> R10.5/R10.6/R10.12

This report classifies **only feedback that actually exists today**. Two required
inputs are not yet available and are owner-gated, so they are listed as pending rather
than guessed at:

- **[#234](https://github.com/beobungbu/BeeUI/issues/234) — independent real-world
  consumer:** `OWNER_ACTION_REQUIRED`. No owner-selected external consumer/access has
  been provided, so no external-consumer friction log exists to classify.
- **[#253](https://github.com/beobungbu/BeeUI/issues/253) — RC soak:** not started;
  no soak findings exist.
- **[#241](https://github.com/beobungbu/BeeUI/issues/241) — reproduce the demo with a
  fresh coding agent:** open; when it lands, its friction log feeds a follow-up pass of
  this document.

## Categories and dispositions

Findings are tagged with the issue's five triage categories:

1. **blocker** — BeeUI 1.0 blocker / correctness gap
2. **doc-gap** — documentation / agent-context gap
3. **compat** — compatibility / packaging gap
4. **app-specific** — application-specific concern (stays in the consumer, not BeeUI)
5. **enhancement** — post-1.0 enhancement

**Severity:** P0 (must fix before RC/freeze) · P1 (should fix for 1.0) · P2 (nice to
have / post-1.0).

**Status:** `fixed-here` (addressed in this PR) · `follow-up` (tracked issue / later
lane) · `wont-fix-1.0` (deliberately out of 1.0 scope, evidence-bounded).

## Summary

| ID | Source | Finding | Category | Sev | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | [#235](https://github.com/beobungbu/BeeUI/issues/235) G1 | No Web bundler recipe (Vite + react-native-web + Uniwind/Tailwind + `@source` globs) in the AI docs; apps build **unstyled** | doc-gap | P0 | fixed-here |
| F2 | #235 G2 | No standalone-consumer install path while unpublished (`pnpm pack` → `file:*.tgz`) in the AI docs | doc-gap | P0 | fixed-here |
| F3 | #235 G3 | Runtime theme switching (`Uniwind.setTheme` / `useUniwind`, `beeRuntimeThemeNames`) undocumented for agents | doc-gap | P0 | fixed-here |
| F4 | #235 G4 | `DatePicker` / `DateTimePicker` being native-only not called out; misleading on Web | doc-gap | P1 | fixed-here |
| F5 | #235 G5 | `Field` / `DescriptionItem` prop-vs-child composition shape under-specified | doc-gap | P2 | fixed-here |
| F6 | [#240](https://github.com/beobungbu/BeeUI/issues/240) | Production-demo visual/product-polish review (hierarchy, empty/loading/error, dark/HC, RTL, motion, touch targets) | app-specific | P1 | follow-up |
| F7 | compat report | `@react-native-community/datetimepicker` has no native compile/runtime evidence (TS-only) | compat | P1 | wont-fix-1.0 |
| F8 | compat report | Sheet native runtime (gesture/drag/snap/keyboard/AT) unverified — owed to [#160](https://github.com/beobungbu/BeeUI/issues/160) | compat | P1 | follow-up |
| F9 | compat report | RN 0.87 excluded — `react-native-safe-area-context@5.7.0` Kotlin fails to build (not a BeeUI defect) | compat | P1 | wont-fix-1.0 |
| F10 | compat report | Web support is Chromium-only; Firefox/WebKit/SSR/other bundlers not claimed | compat | P2 | wont-fix-1.0 |
| F11 | [#62](https://github.com/beobungbu/BeeUI/issues/62) | iOS `pageSheet` tap-swallow overlay race — rare native edge case | blocker? | P2 | follow-up |
| F12 | #234 / #253 | External real-world consumer, RC soak | owner-gated | — | pending |
| F13 | #241 | Fresh-agent demo extend/fix reproduction | agent | — | landed, no freeze-blocking finding |

## Detailed findings

### AI-native documentation gaps (F1–F5, from #235)

The reference-app build notes
([examples/agent-reference-app/AGENT-BUILD-NOTES.md](../examples/agent-reference-app/AGENT-BUILD-NOTES.md))
recorded five gaps where a fresh agent could not build a real Web BeeUI app from the
AI-agent context (the `llms.txt` family + `docs/ai-agent-cookbook.md`) alone. All five
are **documentation-shaped** — the code and packages are correct; only the AI-facing
docs were missing the path. All are addressed in this PR by doc-only patches
(regenerated `llms-full.txt` / `llms-components.txt` and cookbook edits), keeping
`pnpm llms:check` and `pnpm ai-contract:check` green.

- **F1 (G1) — Web bundler recipe.** The llms family said to `@import` the theme CSS but
  never described how to bundle a Web app: `vite-plugin-rnw` (resolve `react-native` →
  `react-native-web`), `@tailwindcss/vite`, `uniwind/vite`, and the `global.css`
  `@import` + `@source` contract. Without the `@source` globs the app builds but ships
  unstyled. **Fix:** new "Web bundling (Vite + react-native-web)" section in
  `llms-full.txt` plus a §5 bullet in the cookbook, both pointing at the buildable
  [examples/web-consumer](../examples/web-consumer) and the compatibility matrix.
- **F2 (G2) — standalone tarball consumption.** For a new standalone app that wants the
  centralized-package model, the only mechanism that works while unpublished (`pnpm
  pack` → `file:*.tgz` → `npm install`) lived only in `examples/README.md`, outside the
  AI context set. **Fix:** new "Consuming the packages before release (pnpm pack
  tarballs)" subsection in `llms-full.txt` and a paragraph in cookbook §2.
- **F3 (G3) — runtime theme switching.** The app-level light/dark switch is
  `Uniwind.setTheme(...)` + `useUniwind()` (from `uniwind`), with runtime names from
  `@beemvp/beeui-tokens` `beeRuntimeThemeNames` — real, exercised in `apps/demo` and
  `apps/showcase`, but absent from the AI docs. **Fix:** new "Runtime theme switching"
  section in `llms-full.txt` and an expanded Recipe F in the cookbook (with the
  `BeeThemeScope` subtree-theming distinction).
- **F4 (G4) — native-only date pickers.** `DatePicker` / `DateTimePicker` ship only as
  `*.native.tsx` (system pickers); a Web agent importing them gets nothing usable.
  **Fix:** explicit "Native-only" line in `llms-components.txt` pointing Web callers to
  `Calendar` as the cross-platform date primitive.
- **F5 (G5) — `Field` composition shape.** `Field` takes `label`/`description`/`error`
  as props with the control as its single child (same shape for `DescriptionItem`).
  **Fix:** a concrete `<Field label=…><Input/></Field>` snippet in cookbook Recipe B.

### Production demo & reference app (F6)

- **F6 — demo visual/product-polish review (#240).** #240 requires a production-level
  UI/UX review (hierarchy/rhythm/typography, responsive behavior, empty/loading/error
  polish, Table readability, date/Sheet interaction, dark/high-contrast, RTL/large text,
  motion, touch targets, content realism). This is **application-quality** work owned by
  the demo lanes (`apps/demo`, #259–263) and the #240 review itself, not a reusable
  BeeUI primitive gap. Disposition: **follow-up** in the demo lanes; a finding only
  becomes a BeeUI issue if it proves a reusable primitive defect (Rule of Two). No such
  reusable defect has been surfaced by the scaffold/shell work to date.

### Compatibility / packaging (F7–F10, from the consumer-compatibility report)

These come from [docs/consumer-compatibility-report.md](consumer-compatibility-report.md)
and the compatibility matrix. They are **already truthfully documented and
evidence-bounded** — listed here so the freeze has an explicit disposition, not because
they are new or hidden.

- **F7 — datetimepicker native evidence.** Only TS/Web-bundle evidence exists; native
  pickers are unverified beyond types. The peer is `optional` and the promise is already
  narrowed to the tested range. Disposition: **wont-fix-1.0** (evidence-bounded; native
  runtime is a device gate, not a code gap). Reinforced by F4's Web-side documentation.
- **F8 — Sheet native runtime.** Gesture/drag/snap/keyboard/AT behavior is unverified
  (deterministic + iOS compile only), owed to
  [#160](https://github.com/beobungbu/BeeUI/issues/160). Disposition: **follow-up**
  (#160); the ADR-006 contract already declines a drag-parity claim.
- **F9 — RN 0.87 exclusion.** `react-native-safe-area-context@5.7.0` Kotlin does not
  build against RN 0.87 (`Unresolved reference 'uiImplementation'`). This is an upstream
  peer defect, not BeeUI; the peer promise caps at `<0.87.0` on real evidence.
  Disposition: **wont-fix-1.0** (narrow the promise, do not document hope).
- **F10 — Web engine/bundler scope.** Chromium-only with Expo/Metro and Vite as the two
  proven bundlers; Firefox/WebKit/SSR and other bundlers are explicitly not claimed.
  Disposition: **wont-fix-1.0** (scope decision, already in the Web support contract).

### Known native edge case (F11)

- **F11 — iOS `pageSheet` overlay race (#62).** A rare iOS `pageSheet` tap-swallow race;
  the kernel-level fix was reverted (unproven, regressed #60), and it is handled at the
  smoke level with a retry. Disposition: **follow-up** — [#62](https://github.com/beobungbu/BeeUI/issues/62)
  stays open as a documented rare native edge case; not a freeze blocker.

### Owner-gated / pending (F12)

- **F12.** [#234](https://github.com/beobungbu/BeeUI/issues/234) (external real-world
  consumer, `OWNER_ACTION_REQUIRED`) and [#253](https://github.com/beobungbu/BeeUI/issues/253)
  (RC soak) have no artifacts to classify yet. Disposition: **pending** — reclassify
  when the owner provides the consumer/access and the soak run lands.
- **F13.** [#241](https://github.com/beobungbu/BeeUI/issues/241) (fresh-agent demo
  extend/fix reproduction) has since **landed and closed**; its reproduction ran against the
  accepted demo and surfaced no freeze-blocking finding. Disposition: **no reclassification
  required** — R10 acceptance and the freeze proceeded on that basis.

## Freeze gate (DoD)

Every material finding above has an owner/disposition. The blocking AI-native
documentation gaps (F1–F3, the only P0s) are **fixed in this PR** and machine-verified
by `pnpm llms:check` + `pnpm ai-contract:check`. The remaining items are either
app-quality follow-ups (F6, F11), evidence-bounded compatibility scope already reflected
in the public peer promise (F7, F9, F10), a tracked native-runtime follow-up (F8), or
owner-gated inputs that do not yet exist (F12). No hidden P0 consumer/demo correctness
gap is known to be entering RC from the currently available feedback; F12 is the only
avenue by which a new P0 could still appear, and it is owner-gated by design.
