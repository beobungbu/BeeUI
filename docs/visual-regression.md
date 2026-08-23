# Visual regression

BeeUI browser verification has two deliberately different layers inside `apps/visual-regression`:

1. deterministic component pixel regression in Chromium;
2. durable integration/layout/runtime QA against the exported real Showcase.

Behavioral, accessibility, contract, native compile, and release-package verification remain separate gates.

## Phase 1 component pixel scope

The deterministic visual fixture lives in `apps/visual-regression` instead of the interactive Showcase. It imports BeeUI only through the public `@beeui/ui` and `@beeui/tokens` package surfaces.

Phase 1 covers representative states rather than every public component:

- `foundation`: Text scale, Button variants/sizes, Badge variants, Card, Separator
- `forms`: Input, Textarea, PasswordInput, Checkbox, Radio, Switch, Field, FormGroup
- `navigation-data`: Tabs, Breadcrumb, Stepper, ListGroup/SettingsItem, Timeline, Progress
- `dialog-open`: an open Dialog
- `alert-dialog-open`: an open AlertDialog
- `popover-open`: an open Popover with a fixed centered anchor
- `dropdown-menu-open`: an open DropdownMenu with a fixed centered anchor

Every canonical scenario runs in this deliberately small matrix:

| Viewport | Pixels | Themes |
| --- | --- | --- |
| mobile | 390 × 844 | light, dark |
| desktop | 1280 × 800 | light, dark |

That yields 28 canonical screenshots.

## Showcase integration QA

The same package owns Playwright integration QA for the executable `apps/showcase` application because this package, not Showcase, owns `@playwright/test` and browser provisioning.

The integration harness:

1. exports the **real Showcase Web app**;
2. serves that export from a temporary local server;
3. opens the Showcase root and navigates through **Components** and **Patterns**;
4. records `pageerror` and `console.error`;
5. validates Component Gallery preservation and representative interactions;
6. validates representative Pattern Gallery screens/states on mobile/desktop in light/dark;
7. inspects top and bottom scroll positions, page-level horizontal overflow, uncontrolled offscreen content, empty preview output, and desktop preview-canvas boundaries;
8. keeps Gallery screenshots in memory for smoke/uniqueness checks rather than committing a 37 × viewport × theme baseline set.

The durable representative Pattern Gallery matrix uses nine high-value scenarios:

- Sign In — server error;
- Profile Setup;
- Dashboard Overview;
- Transactions — error;
- Product Detail;
- Cart;
- Checkout — problem;
- Notification Settings — master off;
- Change Password — invalid.

Those run at 390×844 light/dark, 1280×800 light/dark, plus a 360×800 narrow/mobile stress group.

Component Gallery integration QA runs at 390×844 light/dark and 1280×800 light/dark and confirms that the preserved playground still exposes its prior example groups, accepts form interaction, opens representative Dialog/Popover/DropdownMenu surfaces, emits Toast feedback, avoids horizontal page overflow, and returns to the Showcase section chooser.

The full Pattern Gallery acceptance matrix uses:

- 360×800;
- 390×844;
- 430×932;
- 768×1024;
- 1280×800;
- light + dark;
- all 37 production screens.

That is 10 groups and 370 live screen renders. It is enabled explicitly with `BEEUI_FULL_PATTERN_GALLERY_QA=1`; current CI also runs it so final-head integration evidence is continuously protected while its measured runtime remains acceptable. If the permanent CI cost later becomes unreasonable, the representative matrix must remain in normal CI and the full mode may move to an explicit/manual acceptance invocation without branch-name coupling.

No Gallery PNG baselines are committed.

## Why Chromium first

A single browser keeps the first visual gate understandable and reviewable. Playwright 1.62.1 is pinned and provisions Chromium 151.0.7922.34. The canonical CI comparison runs on BeeUI's protected Ubuntu 24.04 Noble `[self-hosted, beeui]` runner and installs the matching Playwright Chromium browser plus its Linux rendering dependencies with `playwright install --with-deps chromium`.

Firefox, WebKit, iOS Simulator screenshots, and Android emulator screenshots are intentionally out of scope for phase 1. Additional engines should be added only when they protect a concrete compatibility contract.

## Determinism contract

The canonical component screenshot harness controls the common sources of pixel drift:

- Playwright 1.62.1 and Chromium 151.0.7922.34 are pinned.
- Canonical comparison runs on the protected BeeUI Ubuntu 24.04 Noble Linux runner.
- Node is 24.13.1 and pnpm is 10.15.0.
- Browser `deviceScaleFactor` is 1.
- Locale is `en-US` and timezone is `UTC`.
- Each page explicitly emulates `prefers-reduced-motion: reduce` before navigation.
- Content, selections, progress values, and overlay state are fixed.
- No external images or network data are loaded by the deterministic component fixture.
- Global fixture CSS disables animations, transitions, and caret rendering.
- Theme is selected from the URL and applied before readiness is published.
- `document.fonts.ready` is awaited before capture.
- The page publishes `data-visual-ready="true"` only after render frames have settled.
- Anchored overlays additionally wait until their public rendered content has non-zero, in-viewport geometry.
- There are no wall-clock `sleep(...)` calls in the canonical pixel fixture.

The readiness attribute is part of the deterministic fixture contract. Tests must wait for it rather than adding arbitrary delays.

The fixture also commits `uniwind-types.d.ts` so repository-wide TypeScript validation does not depend on Metro having generated the type augmentation first.

The Showcase integration layer is intentionally structural/runtime-oriented rather than pixel-baseline-oriented. It may wait briefly after programmatic scroll changes for browser layout to settle, but it does not compare those pixels to committed Gallery baselines.

## Scenario authoring

Canonical component scenario metadata, themes, viewport definitions, and screenshot naming live in `src/visual-contract.ts`. Add a focused scenario there and render it from `App.tsx`. Prefer one intentional state with fixed text over a large interactive gallery.

A canonical scenario must:

1. use only public BeeUI package exports;
2. avoid current dates, random pixel-visible values, external assets, and uncontrolled async work;
3. have a deterministic initial state;
4. fit the existing viewport/theme matrix unless there is a reviewed reason to expand it;
5. participate in the shared readiness mechanism;
6. use a stable scenario ID because it is part of the baseline filename.

Anchored overlay scenarios must not use private overlay-runtime imports or context workarounds. They exercise only the currently supported public Popover/DropdownMenu contracts.

Showcase browser integration scenarios belong in the Showcase QA helpers/tests under `apps/visual-regression`; do not move Playwright ownership into `apps/showcase` and do not key durable execution to a feature-branch name.

## Local comparison

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/visual-regression exec playwright install --with-deps chromium
pnpm --dir apps/visual-regression test
```

The visual package exports the deterministic fixture for web, starts its local static server through Playwright's `webServer`, compares all expected component screenshots, and runs the durable real-Showcase integration layer.

Run/reproduce the full Pattern Gallery matrix explicitly with:

```sh
BEEUI_FULL_PATTERN_GALLERY_QA=1 pnpm --dir apps/visual-regression test
```

To iterate on one deterministic component scenario, pass normal Playwright filters after building:

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

Gallery integration QA never uses `test:update`; there are no Gallery baseline files to update.

## Snapshot tolerance

The canonical comparison uses `maxDiffPixelRatio: 0.0001` (0.01%). This is deliberately small: it permits a tiny anti-aliasing edge difference without masking component-scale layout, color, spacing, or typography changes.

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
8. exports the executable Showcase and runs the durable Component/Pattern browser integration layer;
9. uploads Playwright test results and the HTML report only on failure.

CI never executes `test:update` or `--update-snapshots`.

Failure artifacts are retained for three days. `test-results` contains actual/expected/diff material produced by canonical Playwright comparisons and failure traces, while `playwright-report` provides the navigable report. Successful jobs do not upload the visual report.

## Debugging a failure

For canonical pixel failures:

1. Open the `visual-web` failure artifacts.
2. Inspect expected, actual, and diff for the failing scenario/project.
3. Re-run the same scenario in the canonical BeeUI Linux/Chromium environment, or on a matching Ubuntu 24.04 Noble machine for initial diagnosis.
4. Decide whether the change is a bug or an intended design change.
5. Fix the implementation for regressions, or run the explicit baseline-update command for intended changes.
6. Visually review the PNG diff before committing updated baselines.
7. Re-run comparison-only CI and confirm the final head is green.

For Showcase integration failures, inspect the named group/scenario plus reported layout/runtime errors; fix the Showcase/pattern/component integration rather than adding a baseline or branch-specific skip.

A failure should never be "fixed" by widening the pixel threshold, deleting the test, branch-gating durable QA, or updating all screenshots without review.

## Known limitations

Chromium browser evidence does not prove native pixel parity. React Native Web, Chromium font rasterization, and Linux rendering can differ from iOS and Android. The canonical suite samples representative component states, while the Showcase layer focuses on integration/layout/runtime behavior rather than pixel identity.

Visual/browser QA does not replace accessibility assertions, behavioral tests, contract tests, native compilation, or protected native runtime/device verification.

## Phase 2: native visual expansion

The next tranche should keep the same canonical scenario IDs and visual intent while adding native capture adapters instead of redesigning the Web harness. Recommended work:

- define a platform-neutral scenario manifest shared by Web/native capture;
- add iOS Simulator capture on the existing protected macOS ARM64 runner;
- add deterministic Android emulator/device capture on an appropriate protected runner;
- pin simulator/emulator OS, device model, display scale, locale, font scale, and animation settings;
- store native baselines separately by platform/device;
- upload native actual/expected/diff diagnostics on failure;
- keep native capture jobs isolated from the existing compile-only gates.

Native screenshot automation should be introduced only after the current Web gates have proven stable in normal pull-request use.
