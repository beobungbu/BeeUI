# Visual regression

BeeUI visual regression is a release-safety layer for rendered component pixels. Phase 1 is intentionally limited to deterministic web screenshots in Chromium. Behavioral, accessibility, contract, native compile, and release-package verification remain separate gates.

## Phase 1 scope

The visual fixture lives in `apps/visual-regression` instead of the interactive Showcase. It imports BeeUI only through the public `@beeui/ui` and `@beeui/tokens` package surfaces.

Phase 1 covers representative states rather than every public component:

- `foundation`: Text scale, Button variants/sizes, Badge variants, Card, Separator
- `forms`: Input, Textarea, PasswordInput, Checkbox, Radio, Switch, Field, FormGroup
- `navigation-data`: Tabs, Breadcrumb, Stepper, ListGroup/SettingsItem, Timeline, Progress
- `dialog-open`: an open Dialog
- `alert-dialog-open`: an open AlertDialog
- `popover-open`: an open Popover with a fixed centered anchor
- `dropdown-menu-open`: an open DropdownMenu with a fixed centered anchor

Every scenario runs in this deliberately small matrix:

| Viewport | Pixels | Themes |
| --- | --- | --- |
| mobile | 390 × 844 | light, dark |
| desktop | 1280 × 800 | light, dark |

That yields 28 canonical screenshots.

## Why Chromium first

A single browser keeps the first visual gate understandable and reviewable. Playwright 1.62.1 is pinned and provisions Chromium 151.0.7922.34. The canonical CI comparison runs on BeeUI's protected Ubuntu 24.04 Noble `[self-hosted, beeui]` runner and installs the matching Playwright Chromium browser plus its Linux rendering dependencies with `playwright install --with-deps chromium`.

Firefox, WebKit, iOS Simulator screenshots, and Android emulator screenshots are intentionally out of scope for phase 1. Additional engines should be added only when they protect a concrete compatibility contract.

## Determinism contract

The harness controls the common sources of screenshot drift:

- Playwright 1.62.1 and Chromium 151.0.7922.34 are pinned.
- Canonical comparison runs on the protected BeeUI Ubuntu 24.04 Noble Linux runner.
- Node is 24.13.1 and pnpm is 10.15.0.
- Browser `deviceScaleFactor` is 1.
- Locale is `en-US` and timezone is `UTC`.
- Each page explicitly emulates `prefers-reduced-motion: reduce` before navigation.
- Content, selections, progress values, and overlay state are fixed.
- No external images or network data are loaded.
- Global fixture CSS disables animations, transitions, and caret rendering.
- Theme is selected from the URL and applied before readiness is published.
- `document.fonts.ready` is awaited before capture.
- The page publishes `data-visual-ready="true"` only after render frames have settled.
- Anchored overlays additionally wait until their public rendered content has non-zero, in-viewport geometry.
- There are no wall-clock `sleep(...)` calls.

The readiness attribute is part of the fixture contract. Tests must wait for it rather than adding arbitrary delays.

The fixture also commits `uniwind-types.d.ts` so repository-wide TypeScript validation does not depend on Metro having generated the type augmentation first.

## Scenario authoring

Scenario metadata, themes, viewport definitions, and screenshot naming live in `src/visual-contract.ts`. Add a focused scenario there and render it from `App.tsx`. Prefer one intentional state with fixed text over a large interactive gallery.

A scenario must:

1. use only public BeeUI package exports;
2. avoid current dates, random pixel-visible values, external assets, and uncontrolled async work;
3. have a deterministic initial state;
4. fit the existing viewport/theme matrix unless there is a reviewed reason to expand it;
5. participate in the shared readiness mechanism;
6. use a stable scenario ID because it is part of the baseline filename.

Anchored overlay scenarios must not use private overlay-runtime imports or context workarounds. They exercise only the currently supported public Popover/DropdownMenu contracts.

## Local comparison

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/visual-regression exec playwright install --with-deps chromium
pnpm --dir apps/visual-regression test
```

The visual package exports the fixture for web, starts the local static server through Playwright's `webServer`, and compares all expected screenshots.

To iterate on one scenario, pass normal Playwright filters after building:

```sh
pnpm --dir apps/visual-regression build:web
pnpm --dir apps/visual-regression exec playwright test -g foundation
```

## Updating baselines intentionally

Baseline replacement is an explicit developer action and is never run by the normal CI comparison job:

```sh
pnpm --dir apps/visual-regression test:update
```

Do not commit baselines produced on macOS when CI compares Linux pixels. Canonical baseline replacements must be generated or revalidated in the same protected BeeUI Ubuntu 24.04 Noble environment used by `visual-web`, with Node 24.13.1, pnpm 10.15.0, Playwright 1.62.1, and Chromium provisioned through:

```sh
pnpm --dir apps/visual-regression exec playwright install --with-deps chromium
```

A developer may use another Ubuntu 24.04 Noble machine to preview an intended update, but those pixels are candidates until they have been compared in the canonical BeeUI runner environment.

Review every changed PNG before committing it. A green update command only means "actual pixels now equal expected pixels"; it does not prove the visual change is desirable.

## Snapshot tolerance

The comparison uses `maxDiffPixelRatio: 0.0001` (0.01%). This is deliberately small: it permits a tiny anti-aliasing edge difference without masking component-scale layout, color, spacing, or typography changes.

Do not increase the threshold merely to make a failing build green. First reproduce in the canonical Linux/Chromium environment and inspect the actual/expected/diff images. Any tolerance change is a release-policy change and should be reviewed as such.

## CI behavior

The `visual-web` job is isolated from `verify`, `bare-native`, and `ios-native`. It:

1. checks out the exact PR/head commit;
2. installs Node 24.13.1 and pnpm 10.15.0;
3. performs a frozen workspace install;
4. provisions Playwright 1.62.1 Chromium and required Linux dependencies on `[self-hosted, beeui]`;
5. reports the exact Playwright and Chromium versions;
6. exports the deterministic fixture and starts it locally;
7. compares the 28 committed PNG baselines;
8. uploads Playwright test results and the HTML report only on failure.

CI never executes `test:update` or `--update-snapshots`.

Failure artifacts are retained for three days. `test-results` contains actual/expected/diff material produced by Playwright, while `playwright-report` provides the navigable report and retained failure traces where available. Successful jobs do not upload the visual report.

## Debugging a failure

1. Open the `visual-web` failure artifacts.
2. Inspect expected, actual, and diff for the failing scenario/project.
3. Re-run the same scenario in the canonical BeeUI Linux/Chromium environment, or on a matching Ubuntu 24.04 Noble machine for initial diagnosis.
4. Decide whether the change is a bug or an intended design change.
5. Fix the implementation for regressions, or run the explicit baseline-update command for intended changes.
6. Visually review the PNG diff before committing updated baselines.
7. Re-run comparison-only CI and confirm the final head is green.

A failure should never be "fixed" by adding sleeps, widening the pixel threshold, deleting the test, or updating all screenshots without review.

## Known limitations

Phase 1 does not prove native pixel parity. React Native Web, Chromium font rasterization, and Linux rendering can differ from iOS and Android. The suite also samples representative states rather than exhaustive component/property combinations.

Visual regression does not replace accessibility assertions, behavioral tests, contract tests, native compilation, or release verification.

## Phase 2: native visual expansion

The next tranche should keep the same scenario IDs and visual intent while adding native capture adapters instead of redesigning the web harness. Recommended work:

- define a platform-neutral scenario manifest shared by web/native capture;
- add iOS Simulator capture on the existing protected macOS ARM64 runner;
- add deterministic Android emulator/device capture on an appropriate protected runner;
- pin simulator/emulator OS, device model, display scale, locale, font scale, and animation settings;
- store native baselines separately by platform/device;
- upload native actual/expected/diff diagnostics on failure;
- keep native capture jobs isolated from the existing compile-only gates.

Native screenshot automation should be introduced only after the phase-1 web gate has proven stable in normal pull-request use.
