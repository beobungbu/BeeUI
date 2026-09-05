---
title: Troubleshooting
description: Search your exact error string and get the cause, the fix, and the command that proves the fix worked.
---

Search this page for the **exact text your console printed**. Every entry below is derived
from a real failure this repository actually produces — a thrown provider error, a starter
script guard, a CI verification script, or a CLI validation message — not from a generic
checklist.

Every entry uses the same schema:

| Field | What it tells you |
| --- | --- |
| **Symptom / exact error** | The literal string to match against your output. |
| **Applies to** | Expo, bare React Native, Web, CLI/source ownership, or the repository itself. |
| **Likely cause** | The one condition that produces this message. |
| **Fix** | The change to make. |
| **Verify** | The command whose success proves it. |
| **Relevant versions** | The tested/promised range this entry is valid for. |
| **Still broken** | Next diagnostic, then where to file. |

:::caution[Distribution status]
BeeUI is **unpublished**. There is no public npm package and no public CLI, so no entry
below tells you to install one. Every fix runs from a BeeUI checkout or from a packed
tarball produced by that checkout. See [Start](/docs/start/).
:::

---

## Providers, overlays, and safe area

### `BeeUI anchored overlays require BeeUIProvider at the application root.`

This is BeeUI's provider-not-found error: no `BeeUIProvider` was found above the component in
the tree.

- **Applies to:** Expo · bare React Native · Web. Thrown by `Popover`, `Select`,
  `DropdownMenu`, `Tooltip`, `DatePicker`, `DateTimePicker`, and anything else that mounts
  an anchored overlay.
- **Likely cause:** the component rendered outside `BeeUIProvider`. Most often the provider
  is mounted *inside* a route/screen instead of at the application root, or a test/story
  renders the component in isolation.
- **Fix:** mount exactly one `BeeUIProvider` at the true application root, above your
  router and above every screen.

```tsx
import { BeeUIProvider, SafeArea, Screen } from '@beemvp/beeui-ui';

export default function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']} className="flex-1">
          {/* routes and screens */}
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

- **Verify:** the overlay opens and closes; `Escape` (Web) or the Android hardware back
  button dismisses the topmost overlay only.
- **Relevant versions:** all currently tested React Native (`>=0.86.0 <0.87.0`) and Web rows.
- **Still broken:** you likely have *two* independent roots (for example a second provider
  mounted by a modal library) each arbitrating its own dismiss stack. Collapse them to one.
  Read [Provider & safe area](/docs/start/provider-safe-area/).

### `BeeUI toast APIs require BeeUIProvider at the application root.`

- **Applies to:** every platform. Thrown by `useToast()`.
- **Likely cause:** `useToast()` was called from a component that is not a descendant of
  `BeeUIProvider` — commonly a component rendered by a portal/host that escaped the
  provider subtree, or a unit test with no provider wrapper.
- **Fix:** move the caller inside the provider subtree, or wrap the test render in
  `BeeUIProvider`.
- **Verify:** calling `show()` renders a toast in the provider's viewport.
- **Relevant versions:** all tested rows.
- **Still broken:** confirm the toast scope you expect — a nested provider reuses the
  supported root runtime rather than creating a second, competing toast host.

### `BeeUI toast show() requires a descriptor with a string title.`

Also: `BeeUI toast show() requires a non-empty string title.`

- **Applies to:** every platform. Thrown by `useToast().show()`.
- **Likely cause:** `show()` was called with a bare string, with `undefined`, or with a
  descriptor whose `title` is empty. The toast API takes a descriptor object and refuses to
  render an unannounceable, unlabelled toast.
- **Fix:** pass `{ title: 'Saved' }` (a non-empty string), plus any optional description.
- **Verify:** the toast renders and is announced by the screen reader.
- **Relevant versions:** all tested rows.
- **Still broken:** if the title is user-supplied, guard the empty case before calling
  `show()` — BeeUI deliberately fails loudly rather than announcing a blank toast.

### Content is double-inset, or sits under the notch / home indicator

This is BeeUI's safe-area-duplicated symptom and its mirror image: the same physical edge
gets padded twice, or no component pads it at all.

- **Applies to:** iOS and Android. Web starters intentionally use no `SafeArea`.
- **Likely cause:** either two nested components each claim the same edge (double inset,
  i.e. the safe-area padding is duplicated), or no component claims an edge that actually
  touches system UI (content underlaps). `Screen`, headers, and bottom bars do not silently
  own all four insets.
- **Fix:** assign each physical edge to exactly one `SafeArea`. The verified starter shape
  is `edges={['top', 'left', 'right']}` on the outer shell, leaving the bottom edge to
  whichever bottom bar actually renders there.
- **Verify:** rotate the device and toggle a bottom bar; no content is clipped and no gap
  doubles.
- **Relevant versions:** `react-native-safe-area-context` `>=5 <6`, tested at `5.7.0`.
- **Still broken:** read [Provider & safe area](/docs/start/provider-safe-area/), which
  documents nested-provider behavior, overlay scopes, and toast scope explicitly.

---

## Expo and Metro resolution

### `packages/<pkg>/dist is missing. Run "pnpm build" ...`

- **Applies to:** every starter under `examples/`, and both consumer verification scripts.
  Thrown by `examples/scripts/pack-beeui-packages.mjs`.
- **Likely cause:** you ran a starter's `setup.sh` before building the workspace. The packer
  refuses to produce a tarball from an unbuilt package.
- **Fix:** build from the repository root first, then re-run setup.

```bash
pnpm build
bash setup.sh
```

- **Verify:** `setup.sh` prints its packing step and installs
  `beemvp-beeui-<pkg>-<version>.tgz` tarballs.
- **Relevant versions:** Node `24.13.1`, pnpm `10.15.0` (this repository is engine-strict).
- **Still broken:** confirm your Node major matches; an engine mismatch fails the workspace
  install long before packing.

### `node_modules is missing; run setup.sh first.`

Also: `app/ is missing; run setup.sh first.` (bare) and
`Web consumer is missing; run prepare first.` / `Production build is missing; run build first.` (CI script).

- **Applies to:** the `examples/*` starters and `scripts/verify-*-consumer.sh`.
- **Likely cause:** a bundle/build step ran before its prepare step, or a previous setup run
  failed partway and left no installed tree.
- **Fix:** run the steps in order — root `pnpm build`, then `bash setup.sh`, then
  `bash bundle.sh` (Expo/bare) or `npm run build` (Web).
- **Verify:** the step prints its own `OK:` success line.
- **Relevant versions:** all.
- **Still broken:** delete the starter's `node_modules` and `.beeui-tarballs` and re-run
  setup from a clean state.

### `Expected Android bundle output missing under dist/_expo/static/js/android`

Also the iOS variant, `Expected iOS bundle output missing under dist/_expo/static/js/ios`.

- **Applies to:** Expo (`examples/expo-package-consumer/bundle.sh`).
- **Likely cause:** `expo export` ran but did not emit every platform — usually because the
  platform list was narrowed, or an earlier Metro resolution error aborted one platform
  while the command still exited zero.
- **Fix:** export all platforms and read the Metro log above the assertion for the first
  unresolved module.
- **Verify:** `bash bundle.sh` prints
  `OK: Expo export produced Android, iOS, and Web bundle output under dist/.`
- **Relevant versions:** Expo SDK `~57.0.0` with `@expo/metro-runtime ~57.0.12`. Expo is not
  a peer dependency of BeeUI.
- **Still broken:** a missing optional native peer (bottom sheet, reanimated,
  gesture-handler, worklets, datetimepicker) resolves on one platform and not another.
  Compare your installed set to [Compatibility](/docs/compatibility/).

### Metro cannot resolve a BeeUI module, or resolves two copies

- **Applies to:** Expo and bare React Native.
- **Likely cause:** the consumer installed BeeUI through a workspace link or a copied
  `dist/` instead of a real packed tarball, so Metro sees duplicate React/React Native
  instances. The supported package boundary is a real `pnpm pack` tarball installed with
  `npm install --save-exact`.
- **Fix:** re-run the starter `setup.sh`, which packs and installs tarballs, and remove any
  hand-added `file:` link into the monorepo.
- **Verify:** `bash bundle.sh` completes and the app renders.
- **Relevant versions:** React `>=19 <20` (tested `19.2.3`), React Native `>=0.86.0 <0.87.0`
  (tested `0.86.2`).
- **Still broken:** the committed starter manifests contain historical tarball filenames
  that `setup.sh` rewrites at install time — never copy those strings by hand as a
  dependency spec.

---

## Bare React Native native builds

### `This bare RN consumer unexpectedly resolves the Expo runtime.`

Also: `Bare consumer unexpectedly resolves the Expo runtime.` (CI) and
`This Web consumer unexpectedly resolves the Expo runtime; it must stay independent of the Showcase's Expo path.`

- **Applies to:** the bare React Native and Web isolation guards.
- **Likely cause:** an Expo package leaked into the consumer tree — commonly by installing
  from inside the monorepo, or by adding a dependency that pulls Expo transitively. The
  guard exists because a bare or Web consumer that silently borrows the Expo runtime is not
  evidence that BeeUI works without Expo.
- **Fix:** install the consumer outside the workspace, from packed tarballs only, and remove
  the Expo-pulling dependency.
- **Verify:** `node -e "require.resolve('expo')"` fails inside the consumer directory, and
  setup completes.
- **Relevant versions:** all.
- **Still broken:** inspect the dependency path with your package manager's `why`/`ls`
  output before adding overrides.

### Android compile fails with `Unresolved reference 'uiImplementation'`

- **Applies to:** bare React Native and Expo prebuild on Android.
- **Likely cause:** React Native `0.87.x`. This is an upstream incompatibility in
  `react-native-safe-area-context@5.7.0` against RN 0.87's native surface — it is not a
  BeeUI defect, and it is the documented root cause of RN 0.87's exclusion.
- **Fix:** pin React Native inside `>=0.86.0 <0.87.0` (tested at `0.86.2`).
- **Verify:** `./gradlew assembleDebug` produces
  `app/build/outputs/apk/debug/app-debug.apk`.
- **Relevant versions:** RN `0.86.2` is the only version this repository builds and tests.
  RN `0.85` has no evidence class at all; RN `0.87` is tested and explicitly excluded.
- **Still broken:** see the RN rows in
  [Compatibility](/docs/compatibility/) before widening a peer range.

### A native module is `undefined` at runtime after adding a dependency

- **Applies to:** iOS and Android.
- **Likely cause:** the JavaScript bundle refreshed but the native app did not rebuild. A
  Fast Refresh cannot link native code.
- **Fix:** reinstall pods (iOS) and rebuild the native app after any native dependency
  change. In an Expo project, re-run prebuild before the native build.
- **Verify:** a clean `assembleDebug` (Android) or `xcodebuild ... build` (iOS) succeeds and
  the module is defined at runtime.
- **Relevant versions:** optional native peers are `@gorhom/bottom-sheet >=5.2 <6`,
  `react-native-reanimated >=4.5 <5`, `react-native-gesture-handler >=2.32 <3`,
  `react-native-worklets >=0.10 <1`, `@react-native-community/datetimepicker >=9.1 <10`.
- **Still broken:** confirm the peer is actually installed in the consumer, not only in the
  workspace.

---

## Web: aliasing, styles, and theme

### The Web app renders, but everything is unstyled

- **Applies to:** Vite + `react-native-web`, and Expo Web.
- **Likely cause:** the CSS entry file is incomplete. BeeUI's semantic theme is delivered as
  CSS custom properties from `@beemvp/beeui-tokens/theme.css`; without it, class names
  resolve to nothing. The `@source` lines are equally required — they tell the styling
  engine to scan BeeUI's own source for the classes it emits.
- **Fix:** the verified CSS entry is exactly five lines:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source '../node_modules/@beemvp/beeui-core/src';
@source '../node_modules/@beemvp/beeui-ui/src';
```

- **Verify:** `npm run build` succeeds and the built page shows themed surfaces, not
  browser defaults.
- **Relevant versions:** Tailwind CSS `>=4 <5` (tested `4.3.3`), Uniwind `>=1.10.1 <2`
  (tested `1.10.1`), `react-native-web` `0.21.0` exact.
- **Still broken:** confirm the entry file is actually imported by your app entry, and that
  the path in each `@source` line matches where your package manager installed BeeUI. Read
  [Web onboarding](/docs/start/web/).

### Metro builds, but native styling is missing

- **Applies to:** Expo and bare React Native.
- **Likely cause:** `metro.config.js` does not wrap the default config with
  `withUniwindConfig`, or `cssEntryFile` points at a file that is not the entry above.
- **Fix:** wrap the config and point `cssEntryFile` at your real CSS entry:

```js
withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
})
```

- **Verify:** `bash bundle.sh` succeeds and the running app is themed.
- **Relevant versions:** as above.
- **Still broken:** if you ship extra brand or high-contrast runtime themes, they must also
  be declared to the Metro config's theme list, or those theme names will not exist at
  runtime. See [Branding](/docs/guides/branding/).

### Web components render but `react-native-web` types or aliases fail

- **Applies to:** Vite + `react-native-web`.
- **Likely cause:** the Vite plugin set is incomplete. The verified plugin order is the
  `react-native-web` plugin, the Tailwind plugin, and the Uniwind plugin with the same
  `cssEntryFile`/`dtsFile` values your CSS entry uses.
- **Fix:** match `examples/web-consumer/vite.config.ts`.
- **Verify:** `npx vite build` succeeds and `dist/index.html` is non-empty.
- **Relevant versions:** Vite `8.2.2`, `vite-plugin-rnw` `0.0.12` (pre-1.0, not peer-declared),
  `@tailwindcss/vite` `4.3.3`.
- **Still broken:** BeeUI's Web contract covers Chromium via Playwright, and the Metro and
  Vite bundlers only. Next.js, Webpack, Parcel, SSR, and SSG are not claimed. Read
  [Web compatibility](/docs/compatibility/web/).

---

## Unsupported compatibility combinations

### `unsupported Node.js version v22.x.x. The BeeUI CLI requires Node >=24 ...`

- **Applies to:** the source-ownership CLI.
- **Likely cause:** the CLI ran on Node 22 or older. Node 24 is the only major this
  repository develops and tests on, so the CLI fails loudly instead of dying later with an
  obscure syntax or API error.
- **Fix:** switch to Node 24 (`nvm use`) and retry.
- **Verify:** `pnpm beeui doctor` prints an `OK` line naming your Node version.
- **Relevant versions:** repository toolchain Node `24.13.1` exact; CLI engine `>=24`.
  Node 22 has no evidence and is not promised.
- **Still broken:** the workspace is `engine-strict`, so an install under the wrong Node
  fails before the CLI is even reachable.

### An install fails complaining about an unsupported engine

- **Applies to:** the repository itself.
- **Likely cause:** a Node/pnpm version outside the pinned toolchain. The repository pins
  Node in `package.json`, `.nvmrc`, and `.node-version`, and enforces it with
  `engine-strict`.
- **Fix:** use Node `24.13.1` and pnpm `10.15.0`.
- **Verify:** `pnpm install` completes, then `pnpm build`.
- **Relevant versions:** as pinned above; these are machine-checked, so they cannot drift
  from the compatibility matrix silently.
- **Still broken:** consumer projects are *your* engine policy, not BeeUI's — only this
  repository is engine-strict.

### A combination "should" work but has no evidence

- **Applies to:** any peer you are considering.
- **Likely cause:** you are reading a promised semver range as if it were a tested version.
  BeeUI states both, and they are not the same claim: the promise is the peer range, the
  evidence is the single tested pin.
- **Fix:** treat [Current tested versions](/docs/compatibility/current/) as the
  evidence, and the peer ranges as the promise.
- **Verify:** reproduce your combination through the starter path for your platform before
  depending on it.
- **Relevant versions:** the generated table is the authority; it is regenerated from the
  machine-checked matrix and is never hand-edited.
- **Still broken:** TypeScript in particular has **no** single machine-checked pin — the
  consumer scripts pin `typescript@5.9.3`, but that is a script pin, not a verified
  compatibility row.

---

## CLI and source-ownership conflicts

### `refusing to overwrite existing files: <paths>; rerun with --overwrite only if replacement is intentional`

- **Applies to:** `pnpm beeui add ...`.
- **Likely cause:** the destination already contains a file with different content — usually
  because you already added that component and then edited it. The CLI refuses to silently
  destroy owned source.
- **Fix:** inspect the difference first, then decide.

```bash
pnpm beeui diff
pnpm beeui add --dry-run button
```

  Only then re-run with `--overwrite` if replacement really is what you want.
- **Verify:** `pnpm beeui diff` reports no unexpected drift afterwards.
- **Relevant versions:** registry `schemaVersion: 1`, `beeui.config.json` schema v1.
- **Still broken:** if you want to keep local edits *and* take upstream changes, use
  `pnpm beeui update`, which never touches a locally edited file unless the upstream
  source for that same file also changed.

### `unknown or unsupported registry item '<name>'`

- **Applies to:** `pnpm beeui add ...`.
- **Likely cause:** a typo, or an internal (non-public) registry item. Only public items are
  addable.
- **Fix:** list the addable surface and copy the exact name.

```bash
pnpm beeui list
```

- **Verify:** the add plan resolves, including transitive registry dependencies.
- **Relevant versions:** registry `schemaVersion: 1`.
- **Still broken:** private utilities are intentionally not addable; they arrive only as
  dependencies of a public item.

### `malformed beeui.config.json: ...` / `unknown config field '<key>'` / `config.themeFile must point to a .css file`

- **Applies to:** every CLI command that reads the project config.
- **Likely cause:** the config was hand-edited into an invalid shape, or carries a field
  outside the supported schema.
- **Fix:** correct the offending field, or remove the file and regenerate a default one.

```bash
pnpm beeui init
```

  `init` never overwrites an existing config, so remove the broken file first if you want a
  fresh one.
- **Verify:** `pnpm beeui doctor` reports a valid `beeui.config.json`.
- **Relevant versions:** config schema v1 — `componentsDir`, `libDir`, `themeFile`.
- **Still broken:** a config schema bump that is not backward compatible is a MAJOR change
  under [Migration & versioning](/docs/guides/migration-versioning/); an unexpected bump
  means you are running a mismatched CLI.

### `bundled registry integrity manifest is missing or unreadable ... the installed @beemvp/beeui-cli package may be corrupted — reinstall the package`

- **Applies to:** `doctor`, `diff`, `update`, and `add`.
- **Likely cause:** the CLI's bundled registry data is absent or unreadable. The registry
  ships inside the CLI package and is never fetched over the network, so a missing manifest
  means the package tree itself is damaged or partially built.
- **Fix:** rebuild the CLI from the checkout before running it:

```bash
pnpm --filter @beemvp/beeui-cli run build
```

- **Verify:** `pnpm beeui doctor` prints
  `BeeUI doctor OK: registry schema v1, ... public components, valid beeui.config.json.`
- **Relevant versions:** CLI engine `>=24`.
- **Still broken:** in a source-ownership starter, `Expected packed CLI binary missing:
  <path>` means the same thing one step earlier — the CLI build has not run yet.

### `This starter unexpectedly resolves @beemvp/beeui-ui; source ownership must not depend on it.`

- **Applies to:** `examples/source-ownership-starter`.
- **Likely cause:** the component package leaked into a project that is supposed to own its
  source outright. Source ownership means the copied files are yours; depending on the
  package as well defeats the model and hides which copy is actually rendering.
- **Fix:** remove the package dependency. A source-owning project keeps only
  `@beemvp/beeui-tokens` plus the ordinary React/React Native peers.
- **Verify:** `node -e "require.resolve('@beemvp/beeui-ui')"` fails, and `npm run build`
  still succeeds.
- **Relevant versions:** all.
- **Still broken:** read [CLI & source ownership](/docs/guides/cli-source-ownership/) for
  the exact boundary between the two consumption models.

### `'add' requires at least one component name, or use --all`

Related usage errors: `'add --all' does not accept explicit item names`,
`unknown add option '<flag>'`, `unknown command '<x>'. Run 'beeui help' for usage.`

- **Applies to:** the CLI argument parser.
- **Likely cause:** a malformed invocation. Note the `--` separator when invoking through
  pnpm: everything after it belongs to the CLI, not to pnpm.
- **Fix:** run `pnpm beeui help` and copy the exact form.
- **Verify:** the command runs and exits `0`.
- **Relevant versions:** commands are `help`, `version`, `init`, `list`, `add`, `doctor`,
  `verify`, `diff`, `update`. Every failure exits `1` with the reason on stderr.
- **Still broken:** do not assume a flag exists because another tool has it — the help
  output is the contract.

---

## Stale generated assets

### A docs page is missing, empty, or contradicts the source

- **Applies to:** this documentation site.
- **Likely cause:** you are looking at a **generated** page that has not been regenerated,
  or someone hand-edited one. The per-component reference, the pattern reference, the
  tested-versions table, the current-release table, the route manifest, and the release
  state are all generated and git-ignored.
- **Fix:** regenerate them; never hand-edit a generated file. Edits are silently discarded
  on the next build.
- **Verify:** the page rebuilds with the expected content, and the docs checks pass.
- **Relevant versions:** all.
- **Still broken:** if a generated page disagrees with a hand-written one, the generated
  page is authoritative — file the hand-written page as the defect.

### A docs build fails a publication-truth check

- **Applies to:** contributors editing documentation.
- **Likely cause:** a page presented BeeUI as installable. Because BeeUI is unpublished,
  public registry-install commands and public CLI invocations are rejected outright unless
  the same line explicitly negates them.
- **Fix:** document the repository-local path instead — workspace commands, starter scripts,
  and `pnpm beeui ...` — and keep the unpublished caution intact.
- **Verify:** `node ./scripts/check-public-doc-truth.mjs` and
  `node ./scripts/check-doc-examples.mjs` both pass.
- **Relevant versions:** current, until the owner publication gate is executed.
- **Still broken:** every identifier a doc example imports must be a real public export, and
  every `pnpm beeui add` target must be a real public registry item — the checks fail on
  invented names.

### Registry, exports, and source drift apart

- **Applies to:** the repository.
- **Likely cause:** a component was added or renamed without updating the registry entry,
  the package export map, or the barrel.
- **Fix:** run the repository's registry and export verification before relying on the CLI.
- **Verify:**

```bash
pnpm registry:verify
pnpm ui-exports:check
pnpm docs:contract:check
```

- **Relevant versions:** registry `schemaVersion: 1`.
- **Still broken:** `pnpm beeui doctor` and `pnpm beeui diff` are consumer-project
  commands, not repository ones — from a BeeUI checkout they exit `1` with `BeeUI is not
  initialized in this project`, and running `init` there would write a stray
  `beeui.config.json` into the monorepo. Run them from inside the consumer project instead,
  where `diff` never mutates anything and is the ground truth about what that project owns.

---

## Still stuck

1. Re-read the entry's **Verify** command and run it verbatim — a fix that does not change
   the verify result is not the fix.
2. Reproduce in the matching starter (`examples/expo-package-consumer`,
   `examples/bare-rn-consumer`, `examples/web-consumer`, or
   `examples/source-ownership-starter`). If the starter passes and your app fails, the
   difference is in your project, and the diff between the two is your bug report.
3. Capture the exact error string, the platform, and your React Native / Expo / Tailwind /
   Uniwind versions.
4. File it at
   [github.com/beobungbu/BeeUI/issues](https://github.com/beobungbu/BeeUI/issues).

## Related

- [Start](/docs/start/) — the onboarding paths every fix above assumes.
- [Provider & safe area](/docs/start/provider-safe-area/) — provider scope, overlay scope, toast scope.
- [Compatibility](/docs/compatibility/) — tested versions versus promised ranges.
- [CLI & source ownership](/docs/guides/cli-source-ownership/) — the full CLI contract.
- [Migration & versioning](/docs/guides/migration-versioning/) — what changes, and when.
- [Keyboard & focus](/docs/accessibility/keyboard-focus/) — Web keyboard expectations.

## Canonical sources

- [Registry CLI contract](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md)
- [Compatibility matrix](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md)
- [Anchored overlays](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md)
- [Web support contract](https://github.com/beobungbu/BeeUI/blob/main/docs/web-support-contract.md)
- [Example consumers](https://github.com/beobungbu/BeeUI/blob/main/examples/README.md)
