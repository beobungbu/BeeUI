# WS-G · scoped theme CSS emission (#550/#552) + DatePicker web `aria-required` residual

Branch: `ws/g-scoped-theme` @ `e2fb63eb2df25b367cab901f4ed8dcae37be4ff8`, based on `fix/consumer-audit-batch` @ `83f6e0e`.

## Per-item status

1. Generator restructure (no `@variant` nested under `:root`) — **fixed and proven**.
2. Two-way proof (Playwright fixture + packed-consumer repro) — **fixed and proven**, both green.
3. `#601` DatePicker/DateTimePicker Web `aria-required` residual — **fixed and proven**.

## 1. Root cause and fix

`scripts/generate-tokens.mjs` used to emit every runtime theme's `--color-*`/`--chart-*` block as
`@variant themeName { ... }` nested inside one shared `:root { }` wrapper. Tailwind compiles that to
`:root:where(.themeName, .themeName *)` — a compound selector that can only ever match the document's
real `<html>` element, so a `BeeThemeScope`-applied class on a nested element never satisfied it (see
`reports/ws-e-report.md` section 6 for the original repro/root-cause writeup).

The fix is not a one-line selector swap — two more subtleties surfaced empirically against this
project's real toolchain and are now covered by generator tests and comments:

- **`@variant` with no enclosing selector is not "unanchored."** CSS nesting's implicit parent for a
  bare `&` is `:scope`, which — absent an `@scope` at-rule — matches only the document root exactly
  like `:root`. Verified directly against the compiled Web bundle (`:scope:where(.violet-light,
  .violet-light *)`), which reproduces the identical bug one level removed. The real values must
  come from a literal, un-anchored selector, not another `@variant` block.
- **`:where(.name, .name *)` breaks nested scopes even when un-anchored.** The `.name *` alternative
  matches every descendant of a themed element *directly*, not just via inheritance. Two nested
  scopes (e.g. an outer `violet-dark` wrapping an inner `violet-light`) both have their `*`
  alternative match the same innermost element; since both compile to zero specificity, the cascade
  picks whichever theme's block sits later in the generated file (source order), not the nearer
  scope — confirmed via `getComputedStyle` on a live nested-scope DOM tree (a `violet-light` scope
  nested inside `violet-dark` resolved to `violet-dark`'s value before this fix). The generator now
  emits a plain `.themeName { ... }` selector (no `, .themeName *`) and relies on ordinary CSS custom
  property inheritance, which always resolves to the *nearest* declaring ancestor.
- **Tailwind/Uniwind still require a literal `@variant` block to register the color as a theme
  color at all.** Uniwind's own Metro bundler (`uniwind/src/bundler/artifacts/css/themes.ts`,
  `generateCSSForThemes`) walks the raw `@variant <themeName> { ... }` at-rule per theme to build a
  declared-variable manifest, and only then emits the synthetic `@theme { --color-x: unset; ... }`
  block that is the *only* reason Tailwind (via the same `@tailwindcss/node` + `@tailwindcss/oxide`
  engine `@tailwindcss/vite` uses) generates `bg-primary`/`text-foreground`/`border-border`/etc. as
  utilities at all. A plain class selector is invisible to that scan. Skipping even one theme drops
  every semantic-color utility for every component (verified: removing `@variant` from all themes
  made `bg-primary` disappear from the compiled CSS entirely, in both the Metro/Expo pipeline and a
  hand-checked Tailwind-oxide run) and, if only some themes keep it, triggers Uniwind's own
  "theme X is missing variable Y" / "All themes must have the same variables" build errors.

Final shape, per theme: an unconditional `:where(:root) { ... }` default (zero specificity, so it
never outranks a real theme selector), one `@variant themeName { ... }` registration block per theme
(inert for cascade purposes — its compiled selector only ever matches `<html>` and carries the
identical values as the real block beside it — but required by both scanners above), and the real
`.themeName { ... }` block that actually drives correct, nesting-aware scoping.

### Before/after compiled selector (Web bundle, `violet-light`)

Before (nested inside `:root`, from `git show HEAD~3` — WS-E's exact finding):
```css
:root:where(.violet-light, .violet-light *) { --color-primary: #7c3aed; ... }
```

After (this fix, from the built `apps/visual-regression` bundle):
```css
:where(.violet-light,.violet-light *){--color-background:#fff; ...}   /* registration @variant, inert */
.violet-light{--color-background:#fff; ... --color-primary:#7c3aed; ...}  /* real, scoped rule */
```

## 2. Two-way proof

### (a) Playwright spec — `apps/visual-regression/tests/theme-scope-tokens.spec.ts`

New `theme-scope-tokens` fixture (`App.tsx`'s `ThemeScopeTokensFixture`): a global reader, a Violet
scope at the opposite appearance, and a Violet scope nested inside that at the global's own
appearance. The spec asserts:
- `getComputedStyle(...).backgroundColor` of each reader's `bg-primary` swatch differs across all
  three (global / scoped / nested).
- `useBeeToken('colors.primary')`, rendered as visible text, differs across all three the same way.
- The DOM-computed swatch color and the `useBeeToken` readout agree with each other on every reader
  (proving #550 and #552 share the same underlying scoped CSS variable).

Result: **green**, both `desktop-light` and `mobile-light` projects.

```
✓ [desktop-light] theme-scope-tokens.spec.ts › BeeThemeScope scopes semantic CSS variables and useBeeToken on Web
✓ [mobile-light] theme-scope-tokens.spec.ts › BeeThemeScope scopes semantic CSS variables and useBeeToken on Web
```

Debug capture from a live nested-scope DOM (global `bee/light`, outer scope `violet/dark`, inner
scope `violet/light`) confirms the CSS custom property itself now resolves correctly at every level,
including the nested-scope-wins case the `.name, .name *` bug broke:

| Element | `--color-primary` (before this fix) | `--color-primary` (after) |
|---|---|---|
| `<html class="light">` (global) | `#f59e0b` | `#f59e0b` |
| `.violet-dark` scope | `#f59e0b` (bug: never applied) | `#a78bfa` |
| `.violet-light` scope nested inside `.violet-dark` | n/a (outer already broken) | `#7c3aed` (correctly overrides the outer scope) |

### (b) Packed-consumer repro (WS-E's exact commands, `examples/web-consumer`)

```
cd examples/web-consumer
bash ./setup.sh
npm run build
npx vite preview --port 4321 --strictPort &
```

Temporary scaffolding (reverted after recording results, `git checkout -- examples/web-consumer/`):
a `ThemeScopeProbe` component reading `useBeeToken('colors.primary')` and rendering a `bg-primary`
`Box`, once at global scope and once inside `<BeeThemeScope brand="violet" appearance="dark">`.

**Observed values (real Chromium, packed npm tarballs, exact WS-E toolchain — Vite 8.2.2,
`@tailwindcss/vite` 4.3.3, `uniwind` 1.10.1):**

Before (WS-E, `reports/ws-e-report.md` section 6):
```
globalToken: global colors.background: #ffffff
scopedToken: scoped (violet/dark) colors.background: #ffffff        <- should differ
globalSwatchColor (bg-primary, getComputedStyle): rgb(245, 158, 11)
scopedSwatchColor (bg-primary, getComputedStyle): rgb(245, 158, 11) <- should be violet-dark's primary
```

After (this fix, re-run against `colors.primary` — the token WS-E's own `colors.background`
example happens to share a value across Bee-light/Violet-light, so `colors.primary` is the
stronger regression signal; both tokens are proven correct via the CSS-variable table above):
```
globalToken: global colors.primary: #f59e0b
scopedToken: scoped (violet/dark) colors.primary: #a78bfa            <- differs correctly
globalSwatch backgroundColor: rgb(245, 158, 11)
scopedSwatch backgroundColor: rgb(167, 139, 250)                     <- matches violet-dark's primary
```

`rgb(167, 139, 250)` is `#a78bfa` — Violet dark's canonical primary — confirming both the CSS
variable (#552) and the `useBeeToken` hook (#550) now correctly resolve the nearest `BeeThemeScope`
in a real external Vite/npm consumer, with no second theme store (`theme-scope.tsx`/`use-bee-token.ts`
are unchanged).

## 3. `#601` residual — DatePicker/DateTimePicker Web `aria-required`

WS-E wired the shared `required: boolean` field into `date-picker-shared.tsx`/
`date-time-picker-shared.tsx` and removed the injected English "required" accessible-name suffix, but
noted the two Web platform files that render the actual trigger DOM node were unowned. Both now pass
`aria-required={field.required || undefined}` to their `PopoverTrigger`, mirroring `Input`'s identical
prop exactly (`input.tsx`). `PopoverTrigger`'s underlying `Button` already spreads unlisted props onto
the rendered `Pressable` (the same mechanism the existing `aria-expanded` prop on this same trigger
already relies on), so no other file needed a change.

Tests added (extending the existing per-component contract test files, not new issue-numbered files):
- `apps/showcase/__tests__/issue-173-date-picker-web.test.tsx` — `aria-required` is `true` when the
  enclosing `Field` is `required`, `undefined` otherwise.
- `apps/showcase/__tests__/issue-174-date-time-picker-web.test.tsx` — same, for `DateTimePicker`.

## Files changed

- `scripts/generate-tokens.mjs` — theme-color CSS emission restructure (item 1).
- `scripts/__tests__/generate-tokens.test.mjs` — updated/added structural assertions for the new
  selector shape and the `@variant` registration blocks.
- `packages/tokens/src/theme.css` — regenerated (never hand-edited).
- `apps/visual-regression/App.tsx` — new `theme-scope-tokens` fixture.
- `apps/visual-regression/tests/theme-scope-tokens.spec.ts` — new Playwright spec.
- `packages/ui/src/components/date-picker.web.tsx` / `date-time-picker.web.tsx` — `aria-required`.
- `apps/showcase/__tests__/issue-173-date-picker-web.test.tsx` / `issue-174-date-time-picker-web.test.tsx` — new tests.

`examples/web-consumer/` scaffolding was added and reverted (`git checkout --`) for the item-2(b)
repro only; no permanent change there.

## Tests added

- `scripts/__tests__/generate-tokens.test.mjs`: "theme colors resolve via a plain class selector
  that inherits at any depth, with an `@variant` registration block per theme for Uniwind/Tailwind
  scanning" — asserts no `@variant` nested under `:root`, exactly one `@variant` registration block
  per runtime theme (in canonical order) each declaring the identical variable-name set, every theme
  also emits a top-level `.themeName { }` block with no `, .themeName *` alternative, and the default
  theme's unconditional fallback is `:where(:root)` (not a bare, higher-specificity `:root`).
- `apps/visual-regression/tests/theme-scope-tokens.spec.ts` (new file, see section 2a).
- `apps/showcase/__tests__/issue-173-date-picker-web.test.tsx` / `issue-174-date-time-picker-web.test.tsx`
  — new `aria-required` cases (see section 3).

## Gate commands and results

```
pnpm lint                                                      → pass (0 warnings)
pnpm tokens:generate                                            → generated 4 files, no diff on rerun
pnpm tokens:check                                                → "Token artifacts are current (4 files)"
pnpm tokens:test                                                 → 174/174 pass
pnpm tokens:consumption-check                                    → "0 violations" (87 files scanned)
pnpm --filter @beemvp/beeui-ui typecheck                         → pass
pnpm --filter @beemvp/beeui-showcase typecheck                   → pass
pnpm --filter @beemvp/beeui-showcase test                        → 119 suites / 1077 tests pass
pnpm --filter @beemvp/beeui-visual-regression typecheck          → pass
node --test scripts/__tests__/generate-tokens.test.mjs           → 60/60 pass
apps/visual-regression: npx playwright test tests/theme-scope-tokens.spec.ts
  --project=desktop-light --project=mobile-light                → 2/2 pass
```

## Unresolved / follow-ups

- **`apps/visual-regression/tests/scoped-preview.spec.ts` (pre-existing, not WS-G-owned, unaffected
  by this fix's correctness):** its functional assertion
  (`primaryButtonBackgrounds[0]).not.toBe(primaryButtonBackgrounds[1])`) passes both before and after
  this change. Its pixel-screenshot comparison shows a small, pre-existing local-environment font-
  rendering diff (~1% of pixels, text kerning shift, not a color/theme difference) reproducible
  identically against the unmodified `main`/`fix/consumer-audit-batch` `theme.css` in this sandbox —
  not a regression introduced here, and out of WS-G's owned files. Flagging for whoever owns CI font
  provisioning for this app, or as a snapshot-refresh housekeeping item.
- The registration `@variant` mechanism (needed purely so Uniwind's Metro bundler and the shared
  Tailwind-oxide scanner recognize semantic colors) is an emergent, undocumented behavior of the
  pinned `uniwind@1.10.1` + `tailwindcss@4.3.3`/`@tailwindcss/oxide` toolchain, verified empirically
  (see generator comments for the exact trace). Worth a short note in `docs/` if/when `uniwind` is
  upgraded, to re-verify this still holds.
