# BeeUI Registry + Source-Ownership CLI

## Status

This is BeeUI's pre-1.0 source-ownership workflow. The CLI engine now lives in the
publishable `packages/cli` (`@beemvp/beeui-cli`) package (#209), but it is **not published to
npm**: do not describe it as `npx @beemvp/beeui-cli` yet. Publication waits for the owner-gated
1.0 release (`docs/beeui-1.0-owner-gates.md` #254).

Current repository-local entry points (unchanged for contributors — `pnpm beeui` delegates
to the same engine as the packed CLI, see "CLI packaging" below):

```sh
pnpm beeui -- help
pnpm beeui -- version
pnpm beeui -- init
pnpm beeui -- list
pnpm beeui -- add button
pnpm beeui -- add --dry-run button
pnpm beeui -- doctor
pnpm registry:verify
pnpm registry:test
pnpm beeui -- add --all
```

The workflow copies supported BeeUI source into a consumer project. The consumer then owns those copied files. It does not create a dependency from the consumer back to this monorepo, does not install packages automatically, and does not fetch executable remote code.

## Required command contract (#210)

The stable, release-ready public command surface — locked so it cannot silently change —
is exactly:

| Command | Arguments | Purpose |
| --- | --- | --- |
| `help` / `--help` / `-h` | none | Print usage. |
| `version` / `--version` / `-v` | none | Print the installed `@beemvp/beeui-cli` name and version. |
| `list` | none | Print the full addable public registry surface, sorted, one per line. |
| `init` | none | Create `beeui.config.json` (never overwrites an existing valid config). |
| `add <items...>` | one or more registry item names | Preflight and copy source plus transitive BeeUI dependencies. |
| `add --all` | none (mutually exclusive with explicit item names) | Add the complete stable public registry surface — the same set `list` prints, i.e. every item with `public: true` in the registry. Never includes internal/transitive-only entries (`core-cn`, `overlay-runtime`, `use-direction`, etc.), which are never `public`. |
| `add --dry-run [...]` | combinable with `<items...>` or `--all` | Compute and print the full plan; write-plan parity with a real `add` (same resolution, transforms, collision preflight, package-requirement report) but no filesystem mutation. |
| `add --overwrite [...]` | combinable with `<items...>` or `--all` | Explicitly replace differing destination files, only after the whole operation passes preflight. |
| `doctor` / `verify` | none (aliases of each other) | Validate the canonical registry, the local config, configured path boundaries, and (see "Registry delivery and integrity" below) the bundled registry's checksum integrity. Never mutates the project. |

Any other top-level command, any unrecognized `add` option (anything starting with `-`
that is not `--all`/`--dry-run`/`--overwrite`), and any unrecognized registry item name
all fail with a non-zero exit code and a specific stderr message before any filesystem
mutation happens — never a silent no-op and never a partial write.

**Exit codes:** `0` on success, `1` for every usage error, validation failure, or runtime
error (unsupported Node version, unknown command/option/item, malformed config/registry,
collision without `--overwrite`, integrity check failure, etc). This binary contract is
deliberate — deterministic, easy for both a human and an agent/script to branch on
(`if beeui add button; then …`), and it avoids inventing a wider code space without a
concrete consumer need. stdout carries plan/status output only; every error message is
written to stderr, never stdout, so scripts can separate the two reliably.

`scripts/__tests__/beeui.test.mjs` pins this contract with tests for the full command
list (including negative cases: unknown command, unknown option, unknown item, `--all`
combined with explicit items, `add` with neither items nor `--all`).

External package installation (running npm/pnpm/yarn/bun on the consumer's behalf) is
explicitly out of this contract's scope; it is a separate, owner-gated decision tracked in
issue #215. `add` only reports required package names/ranges and whether they are already
declared — it never invokes a package manager.

## CLI packaging (#209)

The CLI engine (command parsing, registry validation, dependency resolution, transforms,
collision/overwrite policy) is a single shared implementation at `packages/cli/src/`
(`beeui.mjs` + `registry-lib.mjs`) — there is no repo-local fork and no published fork.
Two thin entry points call the same engine:

- `scripts/beeui.mjs` (repo root) re-exports `packages/cli/src/beeui.mjs` directly, so
  `pnpm beeui -- <command>` keeps working with no build step, against the live monorepo
  registry and component source.
- The publishable `@beemvp/beeui-cli` package's `bin` (`packages/cli/dist/beeui.mjs`, produced by
  `pnpm --filter @beemvp/beeui-cli run build`) runs the same engine standalone.

**Registry-data-shipping decision:** `registry/registry.json` records component sources as
monorepo-relative paths (e.g. `packages/ui/src/components/button.tsx`), which only resolve
inside this checkout. A published tarball is installed standalone into a consumer's
`node_modules` with no monorepo tree present, so `packages/cli`'s build step (
`packages/cli/scripts/build.mjs`) **bundles** a self-contained snapshot rather than
generating one on first run: it copies the canonical `registry.json` plus every unique
source file it references into `packages/cli/dist/registry/` (`registry.json` alongside a
`sources/` tree that mirrors each file's original repo-relative path). The shared engine
auto-detects which mode it is running in — monorepo dev mode or bundled/packed mode — by
checking whether a `registry/` directory exists next to its own file at runtime; no caller
configuration is required either way (see the header comment in
`packages/cli/src/registry-lib.mjs`).

Verify the packed artifact end-to-end (builds `packages/cli/dist/`, then runs the built
`beeui.mjs` as a subprocess against a throwaway consumer directory):

```sh
pnpm cli:smoke
```

## Supported registry entries

Registry coverage has expanded from the initial 6-component slice to the full stable public component-module surface exported by `packages/ui/src/index.ts` (**62 public component modules** as of this writing, including `Table`, #170, and `Sheet`, #161). Run `pnpm beeui -- list` for the canonical, sorted, up-to-date list — it is generated from `registry/registry.json`.

`pnpm registry:verify` additionally compares those public `./components/*` barrel exports with public registry component entries. Adding or removing a public component module without updating the registry therefore fails CI instead of silently allowing registry coverage to drift.

Internal transitive entries (not directly addable, but resolved automatically):

- `core-cn` — the `cn` helper required by most components (single-symbol `@beemvp/beeui-core` import)
- `field-context` — the field context required by `input`/`field`
- `form-group-context` — the form-group context required by `form-group`/`radio`
- `use-required-callback-warning` — the dev-mode controlled-usage warning shared by `checkbox`, `radio`, `segmented-control`, `switch`, `tabs`, `table`
- `core-overlay` — a copy of `@beemvp/beeui-core`'s cn/anchored-overlay/calendar-date/overlay-runtime utilities, used by components whose `@beemvp/beeui-core` import mixes `cn` with anchored-overlay types/functions (`popover`, `dropdown-menu`, `select`, `tooltip`, and the `overlay-runtime`/`use-direction` utilities themselves) or with `calendar-date` functions/types (`calendar`, `date-picker`, `date-time-picker`, #178)
- `overlay-runtime` — the shared anchored-overlay runtime/transport kernel (`overlay-runtime.tsx` plus its platform transport/dismiss-event files), required by `dialog`, `popover`, `dropdown-menu`, `select`, `tooltip`, and `safe-area`
- `use-direction` — the single stateless logical-direction resolver (ADR-004, `use-direction.ts`) required by every component that defaults a `direction` prop from ambient RTL/LTR state: `breadcrumb`, `calendar`, `dropdown-menu`, `pagination`, `popover`, `select`, `table`, and `tooltip` all declare it as an explicit registry dependency (#319 closed the gap where `breadcrumb`/`dropdown-menu`/`pagination`/`popover`/`select` imported the module at the source level without declaring it here)

**Resolved — `@beemvp/beeui-tokens` runtime imports (#355):** `dropdown-menu`, `overlay-runtime`, `popover`, `select`, `sheet`/`sheet.web`/`sheet.native`, `theme-scope`, `toast`, `tooltip.web`/`tooltip.native`, and `use-bee-token` import runtime values (`layer`, `spacing`, `resolveMotion`, `resolveNativeMotion`, and others) directly from `@beemvp/beeui-tokens`. Unlike `@beemvp/beeui-core`, this import is **not vendored**: per [ADR-011](decisions/011-distribution-architecture.md) D5, `@beemvp/beeui-tokens` is now a published package (#199/#200), so each affected registry item declares `@beemvp/beeui-tokens` in its `dependencies` map instead. `beeui add` reports it the same way it reports any other external package requirement (`pnpm beeui -- add sheet` prints `dependency @beemvp/beeui-tokens@<range> [declared in dependencies as <range> | missing from package.json]`) — the copied source keeps its resolvable `@beemvp/beeui-tokens` import, and the consumer installs the package like any other declared dependency.

`button` remains a representative vertical slice. Adding it resolves and copies `core-cn`, `theme`, `text`, and `button` in deterministic dependency order. The resulting Button source imports the copied consumer-local `cn` helper rather than `@beemvp/beeui-core`.

`popover` (or `dropdown-menu`/`select`) is the representative anchored-overlay slice: it resolves `core-cn -> theme -> text -> button -> core-overlay -> overlay-runtime -> popover`, and its `@beemvp/beeui-core` import is rewritten to point at the copied `core-overlay` barrel (`lib/core/index`) via the `rewrite-beeui-core-module` transform (see below).

`sheet` is the representative optional-native-adapter slice: it resolves `core-cn -> theme -> text -> button -> core-overlay -> overlay-runtime -> sheet` (its `sheet.tsx`/`sheet.web.tsx`/`sheet.native.tsx` files use the single-symbol `import { cn } from '@beemvp/beeui-core'` form, so they use `rewrite-beeui-core-cn`, not `rewrite-beeui-core-module`), and reports the four `@gorhom/bottom-sheet`/Reanimated/Gesture-Handler/Worklets optional native peers described above only because `sheet` itself was requested.

## Configuration

`pnpm beeui -- init` creates `beeui.config.json` in the target project's current working directory:

```json
{
  "schemaVersion": 1,
  "componentsDir": "src/components/beeui",
  "libDir": "src/lib/beeui",
  "themeFile": "src/beeui/theme.css"
}
```

The config is versioned and deterministic. Configured paths must be project-relative forward-slash paths. Absolute paths, `..`, empty path segments, Windows absolute paths, and traversal outside the project root are rejected. This exact shape (`schemaVersion`/`componentsDir`/`libDir`/`themeFile`, no other fields) is the stable, locked `init` contract (#214): the same clean-Expo/bare-RN/Web/monorepo fixture always produces the same config, `init` never proposes a path that escapes the project root, and it never guesses application-specific paths beyond the fixed defaults above — a consumer who wants different paths hand-edits the file after `init` creates it (the config format is deliberately simple enough that this is safe).

`init` never silently replaces an existing config: repeat `init` runs are idempotent (same input, same file, same "nothing changed" report), and a malformed existing config, or one from an unsupported `schemaVersion`, fails non-zero with an explicit message rather than being guessed at or migrated automatically — there is no schema migration path yet. A config with `schemaVersion` other than `1` (a future CLI version's format, or a hand-corrupted file) must be hand-edited to match schema `v1` or removed and regenerated with `init`; only the exact JSON shape above is accepted.

`init`'s command output is deterministic, line-oriented `key: value` text (`componentsDir: ...`, `libDir: ...`, `themeFile: ...`, plus the detected-project summary line described below) rather than free-form prose specifically so both a human and a script/agent invoking `beeui init` can parse it reliably without a dedicated `--json` flag — the #210 command contract is locked and this deliberately does not add a new flag to it.

After creating (or validating) the config, `init` also runs the same project detection `doctor` uses (#213, documented in full under "Project detection and dependency diagnostics" below) and prints the detected project kind plus a short, generic list of manual next steps (importing the theme CSS, wrapping the app root with `BeeUIProvider` for a native project, aliasing `react-native` to `react-native-web` for a Web project). This is purely informational — detection never changes which paths `init` writes, and an ambiguous/unknown detection prints an explicit fallback note instead of a guess, never a wrong assumption silently acted on.

## Registry schema

The canonical data file is `registry/registry.json` and currently uses `schemaVersion: 1`. Registry data is JSON; registry entries cannot execute JavaScript or arbitrary commands.

Conceptually, each item contains:

```json
{
  "name": "button",
  "type": "component",
  "public": true,
  "files": [
    {
      "source": "packages/ui/src/components/button.tsx",
      "target": {
        "root": "components",
        "path": "button.tsx"
      },
      "transforms": ["rewrite-beeui-core-cn"]
    }
  ],
  "registryDependencies": ["core-cn", "text", "theme"],
  "dependencies": {
    "class-variance-authority": "0.7.1"
  },
  "peerDependencies": {
    "react": ">=19 <20",
    "react-native": ">=0.86.0 <0.87.0"
  }
}
```

`target.root` is one of:

- `components` — rooted at `config.componentsDir`
- `lib` — rooted at `config.libDir`
- `theme` — exactly `config.themeFile`

The validator checks, before consumer installation work:

- recognized schema version
- item names and duplicate item IDs
- explicit registry dependencies
- missing dependency names
- dependency cycles
- source-file existence
- source paths remaining inside the repository
- duplicate registry target paths
- destination path syntax
- known transform names only
- well-formed external package declarations

The array-based item representation is deliberate: duplicate item names remain detectable instead of being silently collapsed by JSON object-key parsing.

## Dependency resolution

`add` accepts one or more public registry entries. Requested names are de-duplicated and normalized into stable ordering. Transitive registry dependencies are visited in sorted order and emitted before dependents.

Example:

```sh
pnpm beeui -- add button
```

Resolution:

```text
core-cn -> theme -> text -> button
```

For multiple requests, BeeUI resolves the union once. Shared dependencies are copied only once.

External packages are not mutated automatically and no package manager is ever run (no npm, pnpm, yarn, or bun invocation of any kind). The CLI reports required package names/ranges and, for each one, a semver-aware classification of the consumer's own declaration (#212):

| Status | Meaning |
| --- | --- |
| `satisfied` | The declared range overlaps BeeUI's required range. |
| `missing` | The package is required and not declared anywhere in `package.json`. |
| `incompatible` | A declared range exists and is well-formed, but does not overlap the required range. |
| `malformed` | The declared value is not a recognizable version, range, protocol, or dist-tag — fix the string in `package.json`. |
| `unverifiable` | The declared value is a package-manager protocol (`workspace:`, `catalog:`, `npm:`, `file:`, `link:`, a git/http(s) URL) or a dist-tag (`latest`, `next`, ...); its resolved version cannot be known statically. |
| `optional-not-declared` | The package is one of BeeUI's optional native adapters (see below) and simply has not been opted into yet — not an error. |

`add`'s per-plan report appends the status in parentheses after the existing `[declared in ... as ...]`/`[missing from package.json]` detail, e.g. `peer react@>=19 <20 [declared in dependencies as ^18.2.0] (incompatible)`. This is presence-plus-semver-range-overlap analysis against the consumer's *declared* `package.json` value — it never resolves or inspects `node_modules`, so it is correct before `npm install` has ever run and never executes a package manager to find out what actually got installed.

Depending on the requested items, reported requirements can include:

- `class-variance-authority@0.7.1`
- `clsx@2.1.1`
- `tailwind-merge@3.6.0`
- `react@>=19 <20`
- `react-dom@>=19 <20`
- `react-native@>=0.86.0 <0.87.0`
- `react-native-safe-area-context@>=5 <6`
- `react-native-teleport@>=1.1 <2`
- `tailwindcss@>=4 <5`
- `uniwind@>=1.10.1 <2`
- `@gorhom/bottom-sheet@>=5.2 <6` (optional)
- `react-native-reanimated@>=4.5 <5` (optional)
- `react-native-gesture-handler@>=2.32 <3` (optional)
- `react-native-worklets@>=0.10 <1` (optional)

`react-dom`, `react-native-safe-area-context`, and `react-native-teleport` are only reported for items that resolve the `overlay-runtime`/`safe-area`/`toast` utilities (anchored overlays and the app-root provider); plain components never pull them in. A successful source copy therefore does not mean external packages are fully installed.

`@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`, and `react-native-worklets` are reported only when `sheet` is requested (per ADR-006, `docs/decisions/006-sheet-gesture-engine.md`) — no other registry entry's reported requirements change. All four are native-only, optional (`peerDependenciesMeta.optional: true` in `packages/ui/package.json`, mirroring `react-dom` today), and are never imported by `sheet.web.tsx`; only `sheet.native.tsx` requires `@gorhom/bottom-sheet`/`react-native-reanimated`, which in turn require `react-native-gesture-handler`/`react-native-worklets` for their own native modules to link. Installing them without also configuring the required app-root wiring (`GestureHandlerRootView` + `BottomSheetModalProvider`, see `docs/components.md`'s "Sheet boundary" section) still leaves `Sheet` non-functional at runtime — the CLI proves source-copy/package-declaration completeness only, not app-root wiring, which remains a manual consumer step.

These ranges are the declared public promise; `docs/compatibility-matrix.md` is the authority for which point in each range has actually been tested and which parts of the range remain an unverified candidate pending R2 (#130–#135).

## Import transforms

Two narrow source transforms are supported: `rewrite-beeui-core-cn` and `rewrite-beeui-core-module`.

Most component source contains the exact single-symbol import:

```ts
import { cn } from '@beemvp/beeui-core';
```

`rewrite-beeui-core-cn` rewrites that exact import to the relative path of the copied `core-cn` destination in the consumer project. The transform fails if the expected import appears zero times or more than once, which makes upstream source drift visible instead of applying a broad regex heuristic.

A smaller set of files (`popover`, `dropdown-menu`, `select`, `tooltip`, and the internal `overlay-runtime`/`use-direction` utilities) import multiple symbols from `@beemvp/beeui-core` in one statement, or a type-only symbol on its own — `cn` alongside anchored-overlay types/functions, or anchored-overlay types/functions alone. `rewrite-beeui-core-module` rewrites only the `'@beemvp/beeui-core'` module specifier itself (not the imported symbol list) to the relative path of the copied `core-overlay` barrel (`lib/core/index`), which re-exports the same `cn`/anchored-overlay/overlay-runtime surface from mirrored, self-contained copied source. The transform fails the same way if the specifier appears zero times or more than once in the file.

Other imports are copied unchanged. Relative component imports such as `./text` and `./field-context` remain valid because those dependencies are explicitly represented in the registry and copied into the same configured components directory.

Copied output is tested to contain no `workspace:*` references, no `@beemvp/beeui-*` runtime imports, and no references back into monorepo `packages/` paths.

## Theme/token contract

Supported source-owned components use BeeUI semantic Tailwind/Uniwind class names, so theme data is part of the source-ownership contract rather than an implicit prerequisite.

The canonical source is:

```text
packages/tokens/src/theme.css
```

Consumers can copy it explicitly:

```sh
pnpm beeui -- add theme
```

Each registry item that relies on BeeUI semantic theme tokens declares `theme` in its dependency closure, so adding such a component preflights and copies the canonical CSS to `config.themeFile` when it is absent.

The CLI does **not** silently edit an application's existing global CSS entry. After source copy, the consumer must import `config.themeFile` from the CSS entry used by its Tailwind v4/Uniwind setup. This separation avoids guessing which CSS entry file owns the consumer's build configuration.

If `config.themeFile` already exists with identical content, it is `UNCHANGED`. If it differs, the normal collision policy applies; it is never silently overwritten.

## Collision and overwrite policy

Default behavior is no silent overwrite.

Before writing any file, `add` builds the full dependency closure, resolves every destination, applies transforms in memory, checks existing files, and detects all destination collisions. Only after the entire operation passes preflight does filesystem mutation begin.

Existing destination behavior:

- identical content: `UNCHANGED`, success, no write
- different content: fail non-zero by default
- `--overwrite`: replace only after the full operation has passed preflight

Example explicit replacement:

```sh
pnpm beeui -- add --overwrite button
```

`--overwrite` is intentionally explicit. It should not be added to automated workflows casually because source-owned files may contain consumer changes.

A preflight collision prevents unrelated files in the same requested component set from being partially copied.

## Dry run

```sh
pnpm beeui -- add --dry-run button input
```

Dry-run performs the same registry/config validation, dependency resolution, transform calculation, package requirement inspection, symlink/path checks, and collision preflight as a real add. It prints the deterministic plan but creates or changes no destination files.

## Doctor / verify

```sh
pnpm beeui -- doctor
# or
pnpm beeui -- verify
```

This validates the canonical registry, the local `beeui.config.json`, configured path boundaries, practical symlink constraints, and — in a packed/published install — the bundled registry's checksum integrity (see "Registry delivery and integrity" below). It does not add components.

`doctor`'s output line names its registry delivery mode explicitly, e.g.:

```text
BeeUI doctor OK: registry schema v1, 63 public components, valid beeui.config.json, registry delivery: bundled (187 source checksums verified).
```

or, in repository-local dev mode (no bundled manifest to check against):

```text
BeeUI doctor OK: registry schema v1, 63 public components, valid beeui.config.json, registry delivery: dev (live monorepo source tree, no bundled checksum manifest).
```

Repository maintainers can validate the canonical registry independently of any consumer project with:

```sh
pnpm registry:verify
```

### Project detection and dependency diagnostics (#212, #213)

After the registry/config/integrity checks above, `doctor` additionally detects the
consumer's project kind and platform, and prints a semver-aware compatibility report for
the peers relevant to that platform — entirely informational, never blocking:

```text
Detected project: expo (platforms: native), package manager: pnpm, TypeScript: yes, monorepo: no.
  OK            node@v24.13.1 — satisfies the CLI's required >=24
Dependency diagnostics (semver compatibility against BeeUI-supported ranges, informational only):
  OK            react@>=19 <20 — ok
  OK            react-native@>=0.86.0 <0.87.0 — ok
  INCOMPATIBLE  uniwind@>=1.10.1 <2 — declared ^1.0.0 in dependencies does not satisfy required >=1.10.1 <2; update uniwind to a version within >=1.10.1 <2
  MISSING       tailwindcss@>=4 <5 — not declared; install tailwindcss@>=4 <5
```

Detection (`detectProject`, `packages/cli/src/detect.mjs`) reads only the consumer's
`package.json` and a small fixed set of root-level marker files
(`tsconfig.json`, `pnpm-workspace.yaml`, lockfiles) — never `node_modules`, never a parent
directory outside the project root, and never anything that would let it silently rewrite
application configuration (#213's own policy). It classifies the project as one of:

- `expo` — an `expo` dependency is declared.
- `bare-react-native` — a `react-native` dependency is declared without `expo`.
- `web` — a `react-dom` or `react-native-web` dependency is declared without `react-native`.
- `unknown` — none of the above; `doctor`/`init` print an explicit fallback note (never a
  guess) explaining what to check or install first.

It also reports platform capabilities (`native`/`web`, independently — a project can be
both), the package manager (from the `packageManager` field, falling back to lockfile
presence), TypeScript presence (`tsconfig.json` or a declared `typescript` dependency), and
whether the project is a monorepo (`workspaces` field or `pnpm-workspace.yaml`).

The dependency diagnostics list is scoped to what is actually relevant to the detected
project, not BeeUI's entire external-dependency universe:

- `react`, `tailwindcss`, and `uniwind` are always checked — every public component depends
  on them.
- `react-native`, `react-native-safe-area-context`, and `react-native-teleport` are checked
  only when a native platform (`expo`/`react-native`) is detected.
- `react-dom` is checked only when a Web platform (`react-dom`/`react-native-web`) is
  detected.
- `expo` itself is checked (against the Expo SDK line this repository tests, see
  `docs/compatibility-matrix.md`) only for a detected Expo project.
- Every optional native adapter (`@gorhom/bottom-sheet`, `react-native-reanimated`,
  `react-native-gesture-handler`, `react-native-worklets`,
  `@react-native-community/datetimepicker`) is checked only if the consumer has already
  declared it — an undeclared optional peer is not a diagnostic, it simply is not needed
  yet.

`doctor` never fails the command and never mutates the project because of a diagnostic
finding (the same non-blocking posture `add`'s own dependency reporting already uses) —
it is a report, not a gate.

## Registry delivery and integrity (#216)

**Delivery strategy: bundled, not remote.** `@beemvp/beeui-cli` ships its own frozen registry
snapshot inside the published tarball (`dist/registry/registry.json` + `dist/registry/sources/`,
built by `packages/cli/scripts/build.mjs`, see "CLI packaging" above). There is no remote
registry endpoint, no version-negotiation network call, and no "fetch the latest registry"
behavior of any kind. This is a deliberate choice over a versioned static remote registry or
a hybrid: it makes the CLI fully offline-capable (no network access is ever required for
`init`/`list`/`add`/`doctor`) and it makes "which component source will `add button` copy"
a question with exactly one answer per installed `@beemvp/beeui-cli` version — there is no
separate remote registry version to fall out of sync with the installed CLI.

**Version pairing.** The registry snapshot, its bundled sources, and the checksum manifest
below are all written by the same build step from the same commit, and all ship inside the
same npm tarball as the `beeui` binary itself. A given installed `@beemvp/beeui-cli` version can
therefore never observe a registry/source pairing other than the one it was built and
published with; `npm install @beemvp/beeui-cli@x.y.z` always pins all three together.

**Integrity/checksum controls.** The build writes `dist/registry/integrity.json`: a sha256
digest of `registry.json` itself, plus a sha256 digest of every unique bundled source file,
alongside the `cliVersion` that produced them. At runtime:

- `loadRegistry()` verifies the bundled `registry.json`'s digest against the manifest
  before parsing it (every command that touches the registry runs this).
- `add`'s planning step (`buildAddPlan`) verifies each bundled source file's digest
  immediately before it is read/copied into the consumer project — a source file is never
  copied without being checked first.
- `doctor`/`verify` additionally sweeps and verifies **every** unique source file the
  registry can reference (not only the ones a particular `add` request touches), so a
  consumer or CI can detect a tampered/corrupted install without running `add` first.

A checksum mismatch, or a missing/malformed integrity manifest where a bundled registry is
present, fails loudly with a specific error (never a silent fallback, never a partial
plan) and instructs the caller to reinstall the package. This is the "machine check" that
proves the packed artifact cannot silently ship or apply mismatched/untrusted component
source. Repository-local dev mode has no manifest (`registry delivery: dev` above) and is
not checksum-verified — the live monorepo tree is already under git provenance and by
definition changes every commit, so a static checksum would provide no signal there.

**No arbitrary executable registry payload.** The bundled registry is JSON; the bundled
sources are `.tsx`/`.ts`/`.css` component source copied byte-for-byte (subject only to the
two narrow, named import-rewrite transforms below) — never executed, never `eval`'d, never
passed to a shell. This is unchanged by bundling and is exercised by the same tests that
already prove it for the repository-local dev-mode registry (see "Tests" below).

**Compatibility with source-ownership updates and the 1.0 freeze.** Because delivery is
bundle-per-release rather than a mutable remote source, a consumer who has already copied
BeeUI source into their project is never affected by a later `@beemvp/beeui-cli` release changing
what a fresh `add` would produce — they would have to explicitly upgrade `@beemvp/beeui-cli` and
re-run `add`. Until the owner-gated 1.0 release (`docs/beeui-1.0-owner-gates.md` #254),
this package is not published at all, so no compatibility promise is made yet beyond what
this document and its tests already prove against packed artifacts.

**Stable public repository/source URLs.** `packages/cli/package.json` declares
`repository`, `homepage`, and `bugs` URLs pointing at
`github.com/beobungbu/BeeUI`/`packages/cli`; `scripts/verify-release.mjs` asserts these on
every release-verification run.

## Security boundaries

The current repository-local workflow deliberately keeps the trust surface small:

- Node.js built-ins implement CLI parsing and filesystem behavior.
- Registry data is JSON, not executable code.
- No `eval`, `Function`, shell-string interpolation, arbitrary registry commands, telemetry, auth, or remote code fetch exists.
- Registry and config paths reject absolute paths and traversal.
- Existing symlink path segments are rejected for consumer destinations, canonical registry sources, and the config file itself (a symlinked `beeui.config.json` is rejected outright, never followed).
- Registry source realpaths are checked to remain within the repository (dev mode) or the bundled sources directory (packed mode).
- Consumer destinations are resolved and checked to remain within the selected project root, including when an intermediate path segment (e.g. a configured `componentsDir`) is itself a symlink planted to redirect writes outside the project.
- Registry item names are validated against a strict lowercase-kebab-case pattern before any lookup, so a hostile `add` argument (path traversal, absolute path, embedded control character) is rejected by pattern match, not by filesystem behavior.
- A published/packed install additionally verifies bundled registry and source checksums before trusting them (see "Registry delivery and integrity" above) — tampering with an installed package's bundled files is detected, not silently applied.
- Unknown commands, options, items, malformed JSON, invalid dependencies, and cycles fail non-zero before writes.

No path validator can replace operating-system permissions or protect against an actively hostile process racing filesystem changes concurrently. The CLI re-checks destination symlink boundaries immediately before writes to narrow that risk.

## Determinism

Given the same registry version, config, requested item set, source commit, and pre-existing consumer files, BeeUI produces the same:

- requested-item normalization
- transitive dependency order
- destination paths
- transformed source contents
- file action plan
- external dependency ordering

Generated/copied source contains no timestamps or machine-specific absolute paths.

## Tests

`pnpm registry:test` uses temporary consumer projects and Node's test runner. The matrix covers:

- clean and repeated init
- stable list ordering
- explicit theme copy
- Button vertical slice
- Button transitive Text/core/theme dependencies
- multiple component requests
- idempotent repeated add
- collision rejection
- explicit overwrite
- dry-run
- unknown item
- malformed config
- path traversal
- missing registry dependency
- dependency cycle
- duplicate item names
- duplicate targets
- registry source traversal
- deterministic request normalization/plan
- no `workspace:*` / `@beemvp/beeui-*` / monorepo package imports in copied output
- TypeScript/TSX transpile syntax smoke
- copied relative-import graph resolution
- no partial writes after preflight collision
- anchored-overlay module rewrite via Popover
- Table's `use-direction`/`use-required-callback-warning` dependency closure
- doctor behavior, including its reported registry delivery mode
- `version`/`--version`/`-v` output and the full command/flag/exit-code contract (`#210`)
- `add --all` (equivalence with the full public surface, and its mutual exclusivity with
  explicit item names)
- adversarial/public-threat cases (`#211`): hostile `add` item-name arguments (path
  traversal, absolute paths, control characters), a symlinked `componentsDir` segment
  redirecting writes outside the project, a symlinked `beeui.config.json`, and malformed
  registry JSON fed directly to `loadRegistry`
- registry/source checksum integrity (`#216`): matching and mismatched checksums for both
  the registry file and a bundled source file, a missing integrity manifest where one is
  expected, and the full-registry `doctor` sweep
- semver-aware dependency diagnostics (`#212`): exact/caret/tilde/comparator/wildcard range
  parsing and comparison, standard prerelease-exclusion semantics, package-manager protocol
  and dist-tag declarations classified as unverifiable (never as incompatible or missing),
  malformed declarations flagged distinctly, and multi-component requests that share a
  dependency reporting one consistent status
- project/platform detection (`#213`): Expo, bare-RN, Web, monorepo, and ambiguous-project
  fixtures, package-manager and TypeScript detection, and the explicit fallback note an
  unknown/absent `package.json` produces instead of a guess
- `init`'s finalized configuration policy (`#214`): the unsupported-`schemaVersion`
  error's exact non-migrating message, and that `init`'s detected-project guidance never
  mutates the consumer's own `package.json`

`pnpm cli:smoke` additionally builds the real packed `dist/` artifact and, beyond its
existing end-to-end `add`/import-resolution checks, tampers with a bundled source file and
with the bundled `registry.json` after the build to prove the packed binary — not just the
unit-tested engine — refuses tampered bundled data.

The root `pnpm test` command also runs `pnpm registry:verify` and `pnpm registry:test` after the existing showcase test suite.

## Why there is no public `npx @beemvp/beeui-cli` yet

`packages/cli` (`@beemvp/beeui-cli`) now exists as a publication-ready, packed artifact (#209):
it packs and installs standalone, its `beeui` bin runs end-to-end against a bundled
registry snapshot with no monorepo tree present, and `pnpm release:verify` proves this on
every run. It is still **not published to npm**. No package or CLI is published until the
owner explicitly commands the 1.0 release (`docs/beeui-1.0-owner-gates.md` #254); until
then, do not document or advertise `npx @beemvp/beeui-cli` as available.

## Roadmap

`#210` (command contract), `#211` (security invariants), and `#216` (registry delivery +
integrity strategy) are addressed above: the command/flag/exit-code contract is locked and
pinned by tests, the security invariants are preserved and extended with adversarial tests
(malicious item names, symlink races on both destinations and the config file, malformed
registry/config JSON, tampered bundled checksums), and registry delivery is bundled with a
sha256 integrity manifest verified at runtime.

`#212` (semver-aware external dependency diagnostics), `#213` (project/platform detection),
and `#214` (finalized `init` configuration policy) are addressed above too: `add`'s
dependency report and `doctor`'s new project-wide diagnostics both classify declared
consumer ranges against BeeUI's supported ranges (satisfied/missing/incompatible/
malformed/unverifiable/optional-not-declared — see "Dependency resolution" and "Project
detection and dependency diagnostics" above); `detectProject` gives `init`/`doctor` a
deterministic, non-guessing read on Expo/bare-RN/Web/monorepo/ambiguous consumer projects;
and `init`'s `beeui.config.json` shape, defaults, idempotence, and non-migrating
schema-version error are the locked, documented 1.0 contract. `#215` (package-manager
mutation) remains explicitly out of scope — an owner-gated decision this tranche
intentionally does not implement; `add`'s and `doctor`'s reporting stay read-only, never
invoking npm/pnpm/yarn/bun on the consumer's behalf. Remaining follow-on CLI tranche items
can still:

1. decide safe package-manager mutation under a separate explicit contract (`#215`,
   owner-gated);
2. expand source transforms only when each transform has drift/error tests;
3. decide safe diff/update assistance, or explicitly defer it (`#219`).

The registry should stay in lockstep with the stable public component-module surface. `pnpm registry:verify` enforces that invariant; new components must declare their exact source files, internal registry dependencies, external packages, peer expectations, and required transforms before their public export can land. Components with more complex native dependencies or provider/context behavior still need consumer verification appropriate to their runtime contract.
