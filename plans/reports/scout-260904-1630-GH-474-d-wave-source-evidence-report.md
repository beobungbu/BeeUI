# GH-474 D-wave source evidence — scout report

Scope: evidence extraction for #457 (first-success onboarding), #458 (task guides), #462 (Learn), #463 (Reference).
All paths repo-relative to `/Users/textsoft/workspace/BeeUI/.claude/worktrees/issue-474-control-plane-gaps-b93e99`.
Nothing below is invented; where evidence is absent it says UNVERIFIED.

---

## 1. External-consumer proofs

Two consumption models exist (ADR-011 = `docs/decisions/011-distribution-architecture.md`):
**package boundary** (real `pnpm pack` tarballs, never `workspace:*`, never a copied `dist/`) and
**source ownership** (packed CLI copies source into the app).

Shared packer: `examples/scripts/pack-beeui-packages.mjs`
- Usage: `node ../scripts/pack-beeui-packages.mjs --out .beeui-tarballs --packages core,tokens,ui`
- Runs `pnpm --filter @beemvp/beeui-<pkg> pack --pack-destination <out>`; prints `export CORE_TARBALL=…` / `TOKENS_TARBALL` / `UI_TARBALL`; callers `eval "$(…)"`.
- Fails if `packages/<pkg>/dist` is missing → `pnpm build` (repo root) is a hard prerequisite for every starter.

### 1a. Expo

| Facet | Maintained starter `examples/expo-package-consumer/` | CI script `scripts/verify-expo-consumer.sh` |
| --- | --- | --- |
| Mechanism | `pnpm pack` tarballs + `npm install --save-exact` | identical (`npm install --save-exact --legacy-peer-deps`) |
| Work dir | in-tree | `${BEEUI_EXPO_CONSUMER_WORK_ROOT:-${BEEUI_IOS_CACHE_ROOT:-$HOME/Library/Caches/BeeUI}/expo-consumer}/app` |
| Expo SDK | `expo@~57.0.0` in setup.sh; committed lock at `expo 57.0.18` | `EXPO_SDK_VERSION=${BEEUI_EXPO_SDK_VERSION:-57.0.15}` |
| Config files | `metro.config.js`, `global.css`, `app.json`, `index.js` (no committed `tsconfig.json`) | writes `app.json`, `index.js`, `metro.config.js`, `global.css`, `tsconfig.json`, `App.tsx` |
| Metro config | `withUniwindConfig(getDefaultConfig(__dirname), { cssEntryFile: './global.css', dtsFile: './uniwind-types.d.ts', extraThemes: ['violet-light','violet-dark','high-contrast-light','high-contrast-dark'] })` | same minus `extraThemes`, plus pushes `'web'` into `config.resolver.platforms` |
| CSS entry | `@import 'tailwindcss';` / `@import 'uniwind';` / `@import '@beemvp/beeui-tokens/theme.css';` then `@source '../node_modules/@beemvp/beeui-core/src';` `@source '../node_modules/@beemvp/beeui-ui/src';` | identical |
| tsconfig | none committed | `{"extends":"expo/tsconfig.base","compilerOptions":{"strict":true},"include":["**/*.ts","**/*.tsx"]}` |
| Entry | `index.js`: `import '@expo/metro-runtime'; import { registerRootComponent } from 'expo'; import App from './App'; registerRootComponent(App);` | identical |
| Provider/safe area | `<BeeUIProvider><Screen><SafeArea edges={['top','left','right']} className="flex-1">…` (App.tsx) | identical shape |
| Components rendered | `BeeUIProvider`, `SafeArea`, `Screen`, `Card`, `Text`, `Input`, `Checkbox`, `Select*`, `Dialog*`, `Tooltip*`, `Sheet*`, `Table*`, `Calendar`, `useToast`, `useColorScheme`, `useWindowDimensions` | `Card`, `Text`, `Badge` (from `@beemvp/beeui-ui/badge` subpath), `Input`, `Checkbox`, `Chip/ChipGroup`, `Dialog*`, `Button` |
| Verify commands | `pnpm build` (root) → `bash setup.sh` → `bash bundle.sh` (`npx expo export --platform all --output-dir dist`); interactive: `npx expo start` | `bash scripts/verify-expo-consumer.sh {prepare\|typecheck\|bundle\|android-build\|ios-build\|all}`; `all` = prepare + `npx tsc --noEmit` + 3× `npx expo export --platform <web\|android\|ios> --output-dir dist-<p>` |
| Expected output | asserts `dist/_expo/static/js/android` and `.../ios` exist, prints `OK: Expo export produced Android, iOS, and Web bundle output under dist/.` README records `Web Bundled … (663 modules)`, `Android … 3.5MB .hbc`, `iOS … 3.5MB .hbc`, `Exported: dist` | each export asserts `test -d dist-<p>`; native gates: `EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean --no-install --platform android` + `./gradlew assembleDebug --no-daemon --stacktrace --no-configuration-cache --build-cache` asserting `app/build/outputs/apk/debug/app-debug.apk`; iOS = `expo prebuild … --platform ios`, `pod install`, `xcodebuild -workspace … -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` |
| Evidence class | bundle/compile only — README explicitly says no `expo run:ios`/`run:android`, no simulator/device | adds native compile (Gradle APK, xcodebuild) |

Runtime deps installed by `examples/expo-package-consumer/setup.sh` (exact array):
`expo@~57.0.0 @expo/metro-runtime@~57.0.12 react@19.2.3 react-dom@19.2.3 react-native@0.86.2 react-native-web@0.21.0 react-native-safe-area-context@~5.7.0 react-native-teleport@~1.1.13 @react-native-community/datetimepicker@~9.1.0 @gorhom/bottom-sheet@~5.2.14 react-native-reanimated@~4.5.1 react-native-gesture-handler@~2.32.0 react-native-worklets@~0.10.1 tailwindcss@4.3.3 uniwind@1.10.1`
`verify-expo-consumer.sh` uses exact (non-tilde) pins of the same set plus `class-variance-authority@0.7.1`, and `DEV_DEPS=(typescript@5.9.3)`.

### 1b. Bare React Native

| Facet | `examples/bare-rn-consumer/` | `scripts/verify-bare-consumer.sh` |
| --- | --- | --- |
| Scaffold | `npx --yes "@react-native-community/cli@${BEEUI_RN_CLI_VERSION:-20.2.0}" init BeeUIBareConsumer --version ${BEEUI_RN_VERSION:-0.86.2} --directory ./app --pm npm --install-pods false --skip-git-init true`, then `cp src-overrides/{App.tsx,index.js,metro.config.js,global.css} app/` | same CLI/RN pins, app name `BeeUIBareSmoke` under `$WORK_ROOT` |
| Mechanism | pack tarballs + `npm install --save-exact <tarballs> <PINNED_DEPS>` | identical; `NPM_INSTALL_FLAGS` defaults empty so strict peer resolution is part of the contract |
| Pinned peers | `uniwind@1.10.1 tailwindcss@4.3.3 react-native-safe-area-context@5.7.0 react-native-teleport@1.1.13 @react-native-community/datetimepicker@9.1.0 @gorhom/bottom-sheet@5.2.14 react-native-reanimated@4.5.1 react-native-gesture-handler@2.32.0 react-native-worklets@0.10.1 react-dom@19.2.3` | identical list |
| Metro config | `withUniwindConfig(getDefaultConfig(__dirname), { cssEntryFile: './global.css', dtsFile: './uniwind-types.d.ts' })` from `@react-native/metro-config` | same but `cssEntryFile: './src/global.css'`, `dtsFile: './src/uniwind-types.d.ts'` |
| CSS entry | same 3 `@import`s + 2 `@source`s as Expo | same, at `src/global.css` |
| Entry | `src-overrides/index.js`: `AppRegistry.registerComponent(appName, () => App)` with `name` from `app.json` | generated by RN CLI |
| Provider/safe area | `<BeeUIProvider><Screen><SafeArea edges={['top','left','right']} className="flex-1">`; adds `BackHandler.addEventListener('hardwareBackPress', …)` to close `Sheet` (compile/import evidence only) | same provider/SafeArea shape |
| Components | `Input`/`Checkbox`, `Select*`, `Dialog*`, `Tooltip*`, `Sheet*`, `Table*`, `Calendar`, `DateTimePicker`, `Card`, `Text` | `Card`, `Text`, `Badge` subpath, `Input`, `Checkbox`, `Chip/ChipGroup`, `Dialog*`, `Button` |
| Isolation guard | `node -e "require.resolve('expo')"` must FAIL (no Expo runtime) | same guard |
| Verify commands | `pnpm build` → `bash setup.sh` → `bash bundle.sh` | `bash scripts/verify-bare-consumer.sh {prepare\|bundle\|android-build\|ios-build\|android\|ios\|all}` |
| Bundle command | `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output build/index.android.bundle --assets-dest build/android-assets` and `--platform ios … --bundle-output build/main.jsbundle --assets-dest build/ios-assets`; both `test -s` | identical |
| Expected output | `OK: both Android and iOS Metro bundles produced non-empty output.` (README: ~2.3 MB each) | same asserts; native: `./gradlew assembleDebug --no-daemon --stacktrace --build-cache --configuration-cache` → `app/build/outputs/apk/debug/app-debug.apk`; iOS: `bundle install`, `bundle exec pod install`, `xcodebuild -workspace BeeUIBareSmoke.xcworkspace -scheme BeeUIBareSmoke -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' COMPILATION_CACHE_ENABLE_CACHING=YES CODE_SIGNING_ALLOWED=NO build` |
| Not committed | `examples/bare-rn-consumer/app/` (generated native tree) — README explains why | n/a (ephemeral) |

### 1c. Web (Vite + react-native-web)

| Facet | `examples/web-consumer/` | `scripts/verify-web-consumer.sh` |
| --- | --- | --- |
| Mechanism | pack tarballs + `npm install --save-exact` (runtime) and `-D` (dev) | identical |
| Runtime deps | `react@19.2.3 react-dom@19.2.3 react-native@0.86.2 react-native-web@0.21.0 class-variance-authority@0.7.1 react-native-safe-area-context@5.7.0 react-native-teleport@1.1.13 @react-native-community/datetimepicker@9.1.0 @gorhom/bottom-sheet@5.2.14 react-native-reanimated@4.5.1 react-native-gesture-handler@2.32.0 react-native-worklets@0.10.1 tailwindcss@4.3.3 uniwind@1.10.1` | identical |
| Dev deps | `vite@8.2.2 vite-plugin-rnw@0.0.12 @tailwindcss/vite@4.3.3 typescript@5.9.3` | same + `@playwright/test@1.62.1 @axe-core/playwright@4.13.0` |
| `vite.config.ts` | `plugins: [rnw(), tailwindcss(), uniwind({ cssEntryFile: './src/global.css', dtsFile: './src/uniwind-types.d.ts' })]` | same + `preview: { port: Number(process.env.BEEUI_WEB_CONSUMER_PORT ?? 4500), strictPort: true }` |
| `index.html` | `<div id="root"></div>` + `<script type="module" src="/src/main.tsx">` | identical |
| CSS entry | `src/global.css`: same 3 `@import`s + 2 `@source`s | identical |
| Entry | `src/main.tsx`: `import './global.css'; createRoot(container).render(<React.StrictMode><App /></React.StrictMode>)` | identical |
| Provider | `<BeeUIProvider><Screen><div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>…` — **no `SafeArea`** on the Web path | identical |
| Components | `BeeUIProvider`, `Screen`, `Card`, `Text`, `Input`, `Checkbox`, `Popover*` (starter only), `Select*`, `Tooltip*`, `Dialog*`, `Sheet*`, `Table*`, `Calendar` | same minus `Popover*`, plus `Badge` from `@beemvp/beeui-ui/badge` |
| Isolation guard | `node -e "require.resolve('expo')"` must fail | same |
| Verify commands | `pnpm build` → `bash setup.sh` → `npm run build` (`vite build`); optional `npm run preview` | `bash scripts/verify-web-consumer.sh {prepare\|build\|verify\|all}` |
| Build assert | README evidence: `vite v8.2.2 … ✓ 568 modules transformed. dist/index.html 0.41 kB … dist/assets/index-BP0kIRsA.js 574.29 kB … ✓ built in 748ms` | `npx vite build` then `test -s dist/index.html` |
| Interaction proof | none (starter is build-only) | `vite preview --port 4500 --strictPort` + `node verify-consumer.mjs`: Playwright Chromium fills `Project name`, clicks `Enable notifications`, opens `Select` → `Enterprise` and asserts it propagates to the Table cell, focuses Tooltip trigger (keyboard, not hover), opens Dialog + `Escape` to close, opens/dismisses Sheet, clicks a Calendar day cell `/15, \d{4}/`, waits `role=table`, runs `@axe-core/playwright` with tags `wcag2a wcag2aa wcag21a wcag21aa` and fails on any `serious`/`critical`; fails on any console/page error. Success line: `OK: independent Vite + react-native-web consumer — forms, overlays, Select, Tooltip, Sheet, Table, Calendar all interact correctly with no console errors and no serious/critical axe violations.` |

### 1d. Source ownership (4th path — CLI, no `@beemvp/beeui-ui` dependency)

`examples/source-ownership-starter/` (#231). `setup.sh`:
1. `pnpm --filter @beemvp/beeui-cli run build` → `packages/cli/dist/beeui.mjs`
2. `eval "$(node ../scripts/pack-beeui-packages.mjs --out .beeui-tarballs --packages tokens)"`
3. `npm install --save-exact "$TOKENS_TARBALL" react@19.2.3 react-dom@19.2.3 react-native@0.86.2 react-native-web@0.21.0 react-native-safe-area-context@5.7.0 react-native-teleport@1.1.13 class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.6.0 tailwindcss@4.3.3 uniwind@1.10.1`; dev: `vite@8.2.2 vite-plugin-rnw@0.0.12 @tailwindcss/vite@4.3.3 typescript@5.9.3`
4. `node "${CLI_BIN}" init` → `node "${CLI_BIN}" add button popover` → `node "${CLI_BIN}" doctor`
5. Guard: `node -e "require.resolve('@beemvp/beeui-ui')"` must FAIL
6. `npm run build` (`vite build`)

`examples/source-ownership-starter/beeui.config.json` (committed, schema v1):
`{"schemaVersion":1,"componentsDir":"src/components/beeui","libDir":"src/lib/beeui","themeFile":"src/beeui/theme.css"}`
Committed CLI output: `src/components/beeui/{button.tsx,popover.tsx,overlay-runtime.tsx,overlay-dismiss-events.ts,overlay-dismiss-events.web.ts,overlay-host-mode.ts}`, `src/lib/beeui/`, `src/beeui/theme.css`.
Recorded doctor output: `BeeUI doctor OK: registry schema v1, 62 public components, valid beeui.config.json.`

### 1e. Agent reference app

`examples/agent-reference-app/` (#235) — an "Access Requests" console built only from `llms*.txt` + `docs/ai-agent-cookbook.md`; consumes the same pack tarball boundary as the Web starter; gap log at `examples/agent-reference-app/AGENT-BUILD-NOTES.md`.

---

## 2. Supported versions

Machine-checked source of truth per surface:

| Surface | Value | Machine-checked authority |
| --- | --- | --- |
| Node (repo/toolchain) | `24.13.1` exact | `package.json` `engines.node` + `.nvmrc` + `.node-version` + `docs/compatibility-matrix.md` ```json compatibility-matrix``` `node.repo`; enforced by `scripts/check-compatibility-matrix.mjs` (`pnpm compat:check`) and `.npmrc` `engine-strict=true` |
| Node (CLI) | `>=24` | `packages/cli/package.json` `engines.node`; runtime guard `MIN_SUPPORTED_NODE_MAJOR = 24` in `packages/cli/src/beeui.mjs`. Node 22 has **no** evidence — do not claim it. |
| pnpm | `10.15.0` | root `package.json` `packageManager` + matrix block `node.pnpm` |
| React / React DOM | tested `19.2.3`; promised `>=19 <20` (react-dom `optional: true`) | matrix block `react`/`reactDom`; promise in `packages/ui/package.json` `peerDependencies` |
| React Native | tested `0.86.2`; promised `>=0.86.0 <0.87.0` | matrix block `reactNative`; `packages/ui/package.json`. 0.85 dropped (#132), 0.87 excluded (#131, `react-native-safe-area-context@5.7.0` Android `Unresolved reference 'uiImplementation'`) |
| react-native-web | `0.21.0` exact; **not** a declared peer | matrix block `reactNativeWeb` |
| Expo SDK | `~57.0.0` (`@expo/metro-runtime ~57.0.12`); not a peer dependency | matrix block `expoSdkRange`; `apps/showcase/package.json` |
| Tailwind CSS | tested `4.3.3`; promised `>=4 <5` | matrix block `tailwindcss`; `packages/ui/package.json` |
| Uniwind | tested `1.10.1`; promised `>=1.10.1 <2` | matrix block `uniwind` |
| safe-area-context | `5.7.0` (ui dev) / `~5.7.0` (showcase); promise `>=5 <6` | matrix block `safeAreaContext` |
| react-native-teleport | `1.1.13` / `~1.1.13`; promise `>=1.1 <2` | matrix block `teleport` |
| @react-native-community/datetimepicker | `9.1.0`; promise `>=9.1 <10` optional | `packages/ui/package.json` (NOT in the matrix machine block) |
| @gorhom/bottom-sheet | `5.2.14`; promise `>=5.2 <6` optional | `packages/ui/package.json` |
| react-native-reanimated | `4.5.1`; `>=4.5 <5` optional | `packages/ui/package.json` |
| react-native-gesture-handler | `2.32.0`; `>=2.32 <3` optional | `packages/ui/package.json` |
| react-native-worklets | `0.10.1`; `>=0.10 <1` optional | `packages/ui/package.json` |
| TypeScript | root devDep `~5.9.2`; `apps/docs` devDep `~5.9.2`; consumer scripts pin `typescript@5.9.3` | **NOT machine-checked** — no `typescript` key in the matrix block and no reference in `scripts/check-compatibility-matrix.mjs`. Docs must not present a single canonical TS version as machine-verified. |
| Browsers | Chromium only (Playwright) | `docs/compatibility-matrix.md` "Web support contract (#136)" + `docs/web-support-contract.md`. No Firefox/WebKit claim. |
| Bundlers | Expo/Metro and Vite only (`vite-plugin-rnw@0.0.12`, pre-1.0, explicitly not peer-declared and not drift-checked) | same section. Next.js / Webpack / Parcel explicitly not claimed. SSR/SSG explicitly not claimed. |
| Public version | `20260902.0.0` (lockstep across core/tokens/ui/cli) | root `package.json` `version`; asserted `=== '20260902.0.0'` in `scripts/verify-release.mjs` |

Human-readable generated view: `apps/docs/src/content/docs/compatibility/current.generated.md` (gitignored) — rendered by `scripts/public-guide-data.mjs` from the matrix's ```json compatibility-matrix``` block.

### Version disagreements to flag

1. **Expo/native pins drift in the committed starter.** `examples/expo-package-consumer/package.json` has `expo 57.0.18`, `@expo/metro-runtime 57.0.14`, `react-native-reanimated 4.5.5`, `react-native-worklets 0.10.4` — all newer than the matrix/`verify-expo-consumer.sh` pins (`57.0.15`, `57.0.12`, `4.5.1`, `0.10.1`). Those files are npm-resolved lock artifacts, not the tested pins. Docs should cite `docs/compatibility-matrix.md` / the `setup.sh` arrays, never the starter `package.json`.
2. **Stale tarball filenames in committed starter manifests.** `examples/{expo-package-consumer,web-consumer}/package.json` list `"@beemvp/beeui-core": "file:.beeui-tarballs/beeui-core-0.1.0.tgz"` but the packer emits `beemvp-beeui-<pkg>-20260902.0.0.tgz`. `setup.sh` rewrites these at install time, so the committed strings are stale. Do not quote them as install instructions.
3. **`docs/dist-tag-policy.md` machine block contradicts its own prose.** Prose (2026-09-02 owner decision #407) says prereleases are `20260902.0.0-rc.N`; the block still has `"candidateStableVersion": "1.0.0"`, `"prereleaseVersionPattern": "^1\\.0\\.0-rc\\.(0|[1-9][0-9]*)$"`, `"prereleaseExample": "1.0.0-rc.1"`. `apps/docs/src/content/docs/migration/current-release.generated.md` renders `candidateStableVersion` as **"Stable target: `1.0.0`"** while "Workspace/package version" is `20260902.0.0`. Writing agents should not restate a stable-target version; link the generated page instead.
4. TypeScript has no single machine-checked pin (see table).

---

## 3. Release / publication truth (CRITICAL — build-breaking)

**Current state (machine-derived, `apps/docs/public/release-state.json`, gitignored, regenerated by `scripts/generate-docs-foundation.mjs`):**
`published: false`, `status: "unpublished"`, `channel: "closed"`, `currentVersion/workspaceVersion: "20260902.0.0"`,
`packageNames: ["@beemvp/beeui-core","@beemvp/beeui-tokens","@beemvp/beeui-ui"]`, `cliPackageName: "@beemvp/beeui-cli"`,
`cliAvailable: false`, `publicInstallCommandsAvailable: false`, `installCta: "hidden"`, `sourceEvaluationCta: "enabled"`,
`ownerGate: "#254"`, `changelogHref: "/changelog/"`, `migrationHref: "/docs/migration/"`, `sourceEvaluationHref: "/docs/start/"`.

Source of that truth: the ```json dist-tag-policy``` block in `docs/dist-tag-policy.md`, parsed by `readPublicationState()` in `scripts/public-site-contract-lib.mjs`.
UI gate helper: `canShowPublicInstallCta()` in `apps/docs/src/lib/release-state.ts` = `state.published && state.publicInstallCommandsAvailable && state.installCta !== 'hidden'` → currently `false`.

### FORBIDDEN in public docs (`scripts/check-public-doc-truth.mjs`, `pnpm docs:public-truth:check`, part of `pnpm typecheck`)

Scanned roots: `README.md`, `apps/demo/README.md`, `apps/docs/src/content/docs` (extensions `.md .mdx .astro .ts .tsx .json .txt`).
Any line matching one of these fails the build:

```
/\bnpm\s+(?:install|i)\s+@beemvp\/beeui-[a-z0-9-]+/i
/\bpnpm\s+add\s+@beemvp\/beeui-[a-z0-9-]+/i
/\byarn\s+add\s+@beemvp\/beeui-[a-z0-9-]+/i
/\bbun\s+add\s+@beemvp\/beeui-[a-z0-9-]+/i
/\bnpx\s+@beemvp\/beeui-cli\b/i
/\bpnpm\s+dlx\s+@beemvp\/beeui-cli\b/i
```

Escape hatch (same line only): `NEGATED_COMMAND_CONTEXT = /\b(?:do not|don't|not available|unavailable|unpublished|not published|must not|never)\b/i`. So a forbidden command may appear **only** on a line that also carries one of those negations.

### ALLOWED today

- Repository-local commands: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm docs:build`, `pnpm --filter @beemvp/beeui-showcase build:web`, `pnpm --filter @beemvp/beeui-demo build:web`.
- CLI via repo: `pnpm beeui -- add <item>`, `pnpm beeui -- add --dry-run …`, `pnpm beeui -- doctor`, `pnpm beeui -- diff`, `pnpm beeui -- update`.
- Starter flows: `bash setup.sh`, `bash bundle.sh`, `npm run build`, `npx expo start` (these are inside example dirs, not registry installs).
- Package **imports** in code fences (`import { … } from '@beemvp/beeui-ui'`) — never install commands.

### Other enforcing checks

| Check | Rule |
| --- | --- |
| `scripts/public-web-checks/discovery.mjs` | `apps/docs/src/content/docs/cli/index.md` must contain `pnpm beeui -- add --dry-run`, `pnpm beeui -- doctor`, `pnpm beeui -- diff`, `pnpm beeui -- update`; and must NOT contain a fenced `npx @beemvp/beeui-cli` / `npx beeui` / `npm i(nstall) @beemvp/beeui-ui` (regex `/```[^`]*(?:npx\s+(?:@beemvp\/beeui-cli\|beeui)\|npm\s+(?:i\|install)\s+@beemvp\/beeui-ui)/s`). `apps/docs/src/content/docs/ai/index.md` must link `/llms.txt`, `/llms-full.txt`, `/llms-components.txt`, `/llms-patterns.txt`. |
| `scripts/public-web-checks/landing.mjs` | landing must render the publication label and, while unpublished, the literal string `Public npm/CLI publication is not open yet`; must not expose `npm install @beemvp/beeui-*` or `npx @beemvp/beeui-cli`. |
| `scripts/public-web-checks/guides.mjs` | `data.distribution.published !== false` → violation. |
| `scripts/check-public-site-contract.mjs` | `contract.buildTruth.publication.published !== false` → violation; workspace version must equal `currentVersion`. |
| `scripts/generate-docs-foundation.mjs` `validateDocsFoundation()` | while unpublished: `publicInstallCommandsAvailable`, `cliAvailable` must be false, `installCta` must be `hidden`, `ownerGate` must be `#254`, `sourceEvaluationCta` must stay `enabled`. |
| `scripts/check-doc-examples.mjs` check 5 | `docs/component-reference.md` / `docs/pattern-library.md` must not match `/available on npm/i`. |
| `scripts/verify-release.mjs` | asserts root `private === true`, root version `20260902.0.0`, every package on the lockstep version, no `workspace:` in packed manifests, `publishConfig.access === 'public' && publishConfig.provenance === true`. Publication-**readiness**, not publication. |

**Wording rule for the D wave:** "release-ready"/"publication-ready" ≠ published. `docs/dist-tag-policy.md`: *"Technical readiness is not release authorization."* The internal artifact version `<version>-rc-ready.<sha12>` (from `scripts/pack-artifacts.mjs`) is deliberately distinct from a future public `20260902.0.0-rc.N` and must never be presented as a published prerelease.

---

## 4. Reference-hub machine-readable sources

| Reference area | Canonical source(s) a generator should read | Existing generator → human-readable output |
| --- | --- | --- |
| Token groups & runtime values | `packages/tokens/tokens.json` (DTCG canonical, keys `$schema`, `$description`, `$extensions`, `tokens`, `themes`, `primitives`) | `scripts/generate-tokens.mjs` (`pnpm tokens:generate` / `tokens:check`) emits **code**, not docs: `packages/tokens/src/index.ts`, `packages/tokens/src/theme.css`, `packages/tokens/src/tokens.resolver.json`, `packages/tokens/src/lifecycle.json`. **No generator emits a human-readable token reference page today** — `docs/theming.md`, `docs/data-typography.md`, `docs/density.md`, `docs/token-lifecycle.md`, `docs/theme-authoring-primitives.md` are hand-written. `scripts/generate-token-migration-report.mjs` (`pnpm tokens:migration-report [--out <path>]`) renders a lifecycle/migration markdown report on demand. Validators: `scripts/validate-dtcg-schemas.mjs`, `scripts/check-token-removals.mjs`, `scripts/check-semantic-token-consumption.mjs`, `scripts/token-lifecycle.mjs`. |
| Token public API surface | generated `packages/tokens/src/index.ts` (exports: `beeThemeNames`, `beeBrandNames`, `beeRuntimeThemeNames`, `beeThemeRegistry`, `semanticColorTokens`, `chartColorTokens`, `spacing`, `radius`, `fontFamily`, `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`, `numericVariants`, `monoFontFamily`, `controlSize`, `iconSize`, `avatarSize`, `contentWidth`, `breakpoint`, `pageGutter`, density artifacts, `elevation`, `layer`, `motionDuration`, `motionEasing`, `motion`, `resolveMotion`, `focusRing`, `themeOverrideClassification`, `defineThemeOverrides`, `beeTokenReaderCategories`, `beeTokenReader`, `contrastContract`, `chartContrastContract`) + package `exports` map in `packages/tokens/package.json` (`.`, `./motion-runtime`, `./theme.css`, `./tokens.json`, `./tokens.resolver.json`, `./lifecycle.json`, `./package.json`) | file header: `AUTO-GENERATED — DO NOT EDIT DIRECTLY` |
| `packages/core` public exports | `packages/core/src/index.ts` — exactly 4 export blocks: `cn`; calendar-date utilities (`addCalendarDays`, `addCalendarMonths`, `addCalendarYears`, `clampCalendarDate`, `clockTimeFromLocalDate`, `compareCalendarDates`, `fromLocalDate`, `getCalendarDayOfWeek`, `getCalendarMonthGrid`, `getDaysInMonth`, `isCalendarDateDisabled`, `isCalendarDateWithinRange`, `isLeapYear`, `isSameCalendarDate`, `isValidCalendarDate`, `parseISODateString`, `toISODateString`, `toLocalDate` + `CalendarDate`, `CalendarDateDisabledOptions`, `CalendarMonthGridDay`, `CalendarMonthGridOptions`, `CalendarWeekStartsOn`, `ClockTime`); anchored-overlay (`resolveAnchoredOverlayPosition` + 11 types); overlay-runtime (`constrainOverlayViewportToKeyboard`, `createOverlayDismissStack`, `getSafeAreaCollisionPadding`, `mergeOverlayCollisionPadding`, `windowRectToHostRect` + 3 types). Package `exports`: `.` and `./package.json` only. | **No generator renders a `@beemvp/beeui-core` reference page.** Closest machine artifacts: `docs/public-surface.inventory.json` (from `scripts/generate-public-surface-inventory.mjs`, `pnpm docs:surface:generate`) and `llms-full.txt`. |
| `@beemvp/beeui-ui` component reference | `packages/ui/src/index.ts` (barrel, parsed by `parseBarrelExports` in `scripts/generate-llms-txt.mjs`), `packages/ui/package.json` `exports` (per-component subpaths `./accordion` … ), `registry/registry.json`, curated prose in `docs/component-reference.content.json`, showcase usage via `apps/showcase/component-coverage.ts` + `apps/showcase/showcase-target.ts` | YES: `scripts/generate-component-reference.mjs` → `docs/component-reference.md` (`pnpm docs:contract:generate`/`:check`); `scripts/public-component-reference.mjs` → `apps/docs/src/content/docs/components/reference/*.md` (gitignored, built in `apps/docs` pre-hooks); `scripts/public-component-previews.mjs`; `scripts/generate-ui-exports.mjs` for the exports map |
| Patterns | `apps/showcase/patterns`, `docs/pattern-library.content.json` | YES: `scripts/generate-pattern-library.mjs` → `docs/pattern-library.md`; `scripts/public-pattern-reference.mjs` → `apps/docs/src/content/docs/patterns/reference/**` (gitignored) |
| CLI commands & flags | `packages/cli/src/beeui.mjs` (`HELP` const, lines 46–100); repo shim `scripts/beeui.mjs`; `packages/cli/package.json` (`bin: {"beeui": "./dist/beeui.mjs"}`, `engines.node: ">=24"`); prose in `docs/registry-cli.md` | **No generator renders CLI docs**; `apps/docs/src/content/docs/cli/index.md` is hand-written and drift-guarded only by the four required tokens in `scripts/public-web-checks/discovery.mjs`. |
| Registry | `registry/registry.json` (`schemaVersion: 1`, `items[]` — 70 items; per item: `name`, `type`, `public`, `files[{source,target{root,path},transforms[]}]`, `registryDependencies[]`, `dependencies{}`, `peerDependencies{}`); resolution logic `packages/cli/src/registry-lib.mjs` (697 lines) | Validator `scripts/verify-registry.mjs` (`pnpm registry:verify`); `readPublicAddTargets()` in `scripts/check-doc-examples.mjs` derives the addable set (`items.filter(i => i.public)`, which includes the `theme` item). **No human-readable registry reference is generated**; `apps/docs/src/content/docs/registry/index.md` is hand-written. |

**Canonical CLI surface (verbatim from `packages/cli/src/beeui.mjs` HELP):**
commands `help`, `version`, `init`, `list`, `add <items...>`, `doctor`, `verify` (alias for doctor), `diff [items...]`, `update [items...]`.
Add options: `--all`, `--dry-run`, `--overwrite`. Update options: `--dry-run`, `--force`.
Exit codes: `0` success; `1` any usage/validation/runtime error (reason on stderr).
Stated boundaries: does not install npm packages, does not fetch or execute remote code; the registry is bundled with the package (never network-fetched); `doctor` reports whether the bundled data has a verified checksum.

---

## 5. Existing `apps/docs/src/content/docs/` inventory + Diátaxis bucket

Route = `/docs` + path, `index.md` → directory route (per `contentPathToRoute()` in `scripts/generate-docs-foundation.mjs`).
Target sections already reserved in `web/public-site.config.json` `docsFoundation.sections`:
`start → /docs/start/ (#457)`, `learn → /docs/learn/ (#462)`, `components → /docs/components/ (#459, existing)`, `patterns → /docs/patterns/ (#460, existing)`, `guides → /docs/guides/ (#458)`, `reference → /docs/reference/ (#463)`.
Each section route must have a static content owner or `docs:foundation:check` fails.

| File | Route | Covers today | Bucket |
| --- | --- | --- | --- |
| `index.md` | `/docs/` | Docs home | hub (keep) |
| `start/index.md` (19 ln) | `/docs/start/` | Placeholder hub for #457; links to getting-started pages + publication caution | **#457 target** (thin stub) |
| `learn/index.md` (17 ln) | `/docs/learn/` | Placeholder hub for #462 | **#462 target** (thin stub) |
| `guides/index.md` (19 ln) | `/docs/guides/` | Placeholder hub for #458 | **#458 target** (thin stub) |
| `reference/index.md` (19 ln) | `/docs/reference/` | Placeholder hub for #463 | **#463 target** (thin stub) |
| `getting-started/index.md` (115 ln) | `/docs/getting-started/` | Goal table, "fastest repository proof" commands, first BeeUI shell snippet, package-boundary vs source-ownership, evidence classes | **superseded by /docs/start/** (#457) — richest existing onboarding source |
| `getting-started/expo.md` | `/docs/getting-started/expo/` | Expo consumer walkthrough | guides / start |
| `getting-started/bare-react-native.md` | `/docs/getting-started/bare-react-native/` | Bare RN consumer walkthrough | guides / start |
| `getting-started/web.md` | `/docs/getting-started/web/` | Vite + RNW consumer walkthrough | guides / start |
| `getting-started/provider-safe-area.md` | `/docs/getting-started/provider-safe-area/` | `BeeUIProvider` ownership, nested providers, overlay scopes, Toast scope, safe-area edges | **learn** (concept) w/ guide overlap |
| `theming/index.md` (45 ln) | `/docs/theming/` | Semantic color/brand/density/runtime theme contracts | **learn** (concept) + guide split |
| `theming/branding.md` | `/docs/theming/branding/` | Apply your own brand tokens | **guides** |
| `theming/density.md` | `/docs/theming/density/` | Compact/comfortable/spacious | **guides** |
| `cli/index.md` (62 ln) | `/docs/cli/` | Repository-local Registry workflow, `pnpm beeui --` commands | **guides** (workflow) + **reference** (command/flag table) |
| `troubleshooting/index.md` (48 ln) | `/docs/troubleshooting/` | Symptom-indexed diagnosis (setup, safe area, theme, Metro, overlay, data controls, Registry) | **guides** |
| `migration/index.md` (29 ln) | `/docs/migration/` | Upgrade packages/tokens/source-owned components | **guides** |
| `migration/current-release.generated.md` | `/docs/migration/current-release/` | Generated version/publication/channel table | **reference** (generated) |
| `compatibility/index.md` (34 ln) | `/docs/compatibility/` | Tested combinations overview | **reference** |
| `compatibility/native.md` | `/docs/compatibility/native/` | What native verification proves / does not | **reference** (+ learn on evidence classes) |
| `compatibility/web.md` | `/docs/compatibility/web/` | Web boundary: engine, bundlers, consumer proof | **reference** |
| `compatibility/current.generated.md` | `/docs/compatibility/current/` | Generated tested-versions table | **reference** (generated) |
| `performance/index.md` (22 ln) | `/docs/performance/` | Benchmark classes, bundle footprint, regression budgets | **learn** (concept) + reference (budget numbers) |
| `release-security/index.md` (24 ln) | `/docs/release-security/` | Publication state, channels, security reporting, license | **reference** |
| `registry/index.md` (40 ln) | `/docs/registry/` | Registry items, dependency closure, integrity, consumer-owned update behavior | **reference** (item schema) + **guides** (add/diff/update flow) |
| `ai/index.md` (43 ln) | `/docs/ai/` | Canonical agent context + verification boundaries; links the 4 `llms*.txt` | **guides** (task: wire an agent) |
| `accessibility/index.md` (29 ln) | `/docs/accessibility/` | Semantics/keyboard/large-text/l10n/motion/native AT overview | **learn** |
| `accessibility/keyboard-focus.md` | `/docs/accessibility/keyboard-focus/` | Keyboard + focus-visible across Web/native | **guides** |
| `accessibility/large-text.md` | `/docs/accessibility/large-text/` | Dynamic Type, large text, 200% zoom | **guides** |
| `accessibility/native-assistive-tech.md` | `/docs/accessibility/native-assistive-tech/` | VoiceOver/TalkBack expectations + evidence boundary | **learn** (+ reference on evidence class) |
| `accessibility/reduced-motion.md` | `/docs/accessibility/reduced-motion/` | Reduced-motion policy | **guides** |
| `accessibility/rtl.md` | `/docs/accessibility/rtl/` | RTL + localized/long content | **guides** |
| `architecture.md` | `/docs/architecture/` | Mobile-first scope, semantic contracts, distribution choices, ownership boundaries | **learn** |
| `responsive.md` | `/docs/responsive/` | Narrow-phone default → medium → expanded | **learn** (+ guide) |
| `reference-app.md` | `/docs/reference-app/` | Routed support-workspace demo app tour | **learn** (example/explanation), not API reference |
| `showcase.md` (65 ln) | `/docs/showcase/` | Inspect Web runtime, run Showcase on iOS/Android | **guides** |
| `components/index.md` | `/docs/components/` | Component family browse | reference hub (#459, existing) |
| `components/table.md` | `/docs/components/table/` | Table/DataTable | guides/learn deep dive |
| `components/calendar-date-time.md` | `/docs/components/calendar-date-time/` | Calendar/DatePicker/DateTimePicker | guides/learn deep dive |
| `components/reference/*.md` (79 files) | `/docs/components/reference/<name>/` | **GENERATED**, gitignored | reference (#459) |
| `patterns/index.md` | `/docs/patterns/` | Production screen compositions | patterns hub (#460) |
| `patterns/reference/**` (4 packs, 36 files) | `/docs/patterns/reference/<pack>/<slug>/` | **GENERATED**, gitignored | patterns (#460) |

Generated/gitignored (`.gitignore` lines 23–28): `components/reference/`, `patterns/reference/`, `compatibility/current.generated.md`, `migration/current-release.generated.md`, `apps/docs/public/route-manifest.json`, `apps/docs/public/release-state.json`. **Never hand-edit these.**

Sidebar authority: `apps/docs/astro.config.mjs` `starlight({ sidebar: [...] })`. Today it has NO entries for `/docs/start/`, `/docs/learn/`, `/docs/guides/`, `/docs/reference/`, `/docs/registry/`, `/docs/ai/`, `/docs/architecture/`, `/docs/responsive/`, `/docs/reference-app/`, `accessibility/keyboard-focus`, `accessibility/reduced-motion`, `accessibility/native-assistive-tech` — those pages exist but are unlinked from the sidebar. New sections must be added there (config comment: W2/#414 owns global route/IA authority; content workstreams may add sidebar-local entries).

---

## 6. Docs quality gates content must satisfy

Run order in `pnpm typecheck`: `hygiene:check → docs:public-truth:check → site:contract:check → docs:foundation:check → docs:surface:check → web:check → release-control-plane:check → lint → tokens:check → … → docs:contract:check → docs:examples:check → docs:patterns:check → build → -r typecheck`.

### 6.1 `scripts/check-doc-examples.mjs` (`pnpm docs:examples:check`)
Roots: `docs/` and `apps/docs/src/content/` (extensions `.md`, `.mdx`; skips dotfiles and `node_modules`).
1. **Every identifier imported from `'@beemvp/beeui-ui'` in any doc must be a real barrel export** (value or type) of `packages/ui/src/index.ts`. Non-identifier placeholders (`…`, `<X>`) are ignored. → never invent a component/type name in an example import.
2. **Every `pnpm beeui -- add [flags] <item>` token must be a `public: true` item name in `registry/registry.json`.** Regex: `/pnpm beeui -- add((?:\s+--[a-z-]+)*)\s+([a-z][a-z0-9 -]*)/g`; tokens matched as `^[a-z][a-z0-9-]*$`. (`theme` is a valid target.)
3. Showcase links in `docs/component-reference.md` / `docs/pattern-library.md` must resolve on disk.
4. Cited showcase fixtures must actually import from `@beemvp/beeui-ui`.
5. Those two generated references must not match `/available on npm/i`.

### 6.2 `scripts/check-public-doc-truth.mjs` (`pnpm docs:public-truth:check`)
See §3 for the six forbidden regexes and the negation escape hatch. Also enforces on `apps/demo/README.md`: no bare `npm run build`; must contain `pnpm --filter @beemvp/beeui-demo start`, `pnpm --filter @beemvp/beeui-demo web`, `pnpm --filter @beemvp/beeui-demo build:web`.

### 6.3 `scripts/check-public-web.mjs` (`pnpm web:check`)
Loads every `scripts/public-web-checks/*.mjs` and calls its exported `collectViolations(rootDir)`. Content-relevant rules:

**`getting-started.mjs`** — required files: `apps/docs/src/content/docs/getting-started/{index,expo,bare-react-native,web,provider-safe-area}.md`.
- No file may match `/content pending|intentionally stubs?|follow-up docs content issue/i`.
- Every one except `provider-safe-area.md` must contain the literal `/docs/` (canonical link base).
- `index.md` must contain: `examples/expo-package-consumer`, `examples/bare-rn-consumer`, `examples/web-consumer`, `Package boundary`, `Source ownership`.
- `expo.md` must contain: `bash setup.sh`, `bash bundle.sh`, `npx expo start`, `@import '@beemvp/beeui-tokens/theme.css';`, `withUniwindConfig`, plus `@import 'tailwindcss';`, `@import 'uniwind';`, `cssEntryFile: './global.css'` — and each of those must *also* still be present in `examples/expo-package-consumer/global.css` / `metro.config.js` (two-way drift guard).
- `bare-react-native.md` must contain: `examples/bare-rn-consumer`, `bash setup.sh`, `bash bundle.sh`, `Metro bundling`.
- `web.md` must contain: `examples/web-consumer`, `bash setup.sh`, `npm run build`, `React Native Web`.
- `provider-safe-area.md` must contain: `Nested BeeUIProvider behavior`, `Overlay scopes`, `Toast scope`, `edges={['top', 'left', 'right']}` (exact spacing).

**`guides.mjs`** — required guide corpus (all must exist): `theming/index.md`, `responsive.md`, `accessibility/index.md`, `accessibility/keyboard-focus.md`, `accessibility/reduced-motion.md`, `accessibility/native-assistive-tech.md`, `compatibility/index.md`, `migration/index.md`, `troubleshooting/index.md`, `performance/index.md`, `release-security/index.md`, `architecture.md`.
- None may match `/content pending|tracked for a follow-up|intentionally a stub/i`.
- **Each must contain the literal string `github.com/beobungbu/BeeUI`** (canonical source link) — easy first-try failure.
- Also asserts guide-data version == root `package.json` version and `distribution.published === false`.

**`discovery.mjs`** — CLI/registry/AI guides must exist; CLI required tokens + fenced-npx ban (see §3); AI guide must link all four `/llms*.txt`; `examples/README.md` must still document `expo-package-consumer/`, `bare-rn-consumer/`, `web-consumer/`, `source-ownership-starter/`, `agent-reference-app/`, and each dir must exist.

**`seo.mjs`** — landing/examples/component/pattern/changelog pages must carry `rel="canonical"`, `og:title`, `og:description`, `og:image`, `twitter:card`; no `workers.dev` leakage; sitemap must contain `/`, `/docs/`, `/docs/components/`, `/docs/patterns/`, `/examples/`, `/changelog/`, `/showcase/`, `/demo/`; `/llms.txt` and `/api/` must NOT be in the sitemap; `.gitignore` must still ignore the two generated docs dirs.

**`landing.mjs`**, **`showcase.mjs`**, **`demo.mjs`**, **`component-reference.mjs`**, **`component-previews.mjs`**, **`pattern-reference.mjs`**, **`worker.mjs`** — site-shell/generator checks, not markdown-authoring rules.

### 6.4 `scripts/generate-docs-foundation.mjs --check` (`pnpm docs:foundation:check`)
Every `docsFoundation.sections[].route` must have a static content owner under `apps/docs/src/content/docs/` (an `index.md` at that path). Deleting or moving `start/`, `learn/`, `guides/`, `reference/` index files fails the build. Also: unique section ids/routes, no redirect loops/cycles, `sourceToPage[].sources`/`generator` must exist on disk, production `index,follow`, dev/staging `noindex,nofollow` + `robotsDisallow` containing `/`, and the release-state invariants in §3.

### 6.5 Frontmatter
`apps/docs/src/content.config.ts` uses Astro Starlight's stock `docsSchema()` — no custom required fields. Every existing page uses exactly:
```
---
title: <Title Case short noun phrase>
description: <one sentence>
---
```
Follow that. Starlight asides in use: `:::caution[Label] … :::`.

### 6.6 Code fences
No check enforces a fence language. Observed conventions: `bash` for shell command blocks in docs pages, `sh` in `examples/*/README.md`, `tsx` for component snippets, `ts` for TypeScript, ```` ```json <tag> ```` for machine-parsed blocks (`compatibility-matrix`, `dist-tag-policy`) — **only in `docs/*.md`, never in `apps/docs` content**. Note the CLI ban in `discovery.mjs` is fence-scoped, so an `npx @beemvp/beeui-cli` mention inside a fence in `cli/index.md` fails even if a negation word is nearby on the same line elsewhere.

### 6.7 Repo hygiene (`scripts/check-repo-hygiene.mjs`)
Tracked files must be mode `100644` (only `scripts/verify-bare-consumer.sh` may be `100755`) and LF-only line endings.

---

## Open questions / uncertainties

- UNVERIFIED: whether `pnpm docs:build` currently passes on this worktree (no builds were run, per instructions).
- UNVERIFIED: exact content of `worker.mjs` route rules for new `/docs/<section>/` subtrees — read `scripts/public-web-checks/worker.mjs` (215 ln) before adding routes outside `/docs/`.
- The `dist-tag-policy` machine block's `candidateStableVersion: "1.0.0"` / `prereleaseVersionPattern` disagreeing with the `20260902` prose (§2, item 3) is a real inconsistency that the D-wave writing agents should route to the owner rather than paper over.
- No generator exists for token, `@beemvp/beeui-core`, CLI, or Registry reference pages. #463 either writes them by hand against the canonical sources named in §4, or introduces new generators (which would then need `sourceToPage` entries in `web/public-site.config.json`).
