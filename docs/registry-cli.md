# BeeUI Registry + Source-Ownership CLI

## Status

This is BeeUI's first pre-1.0, repository-local source-ownership workflow. It is intentionally not a published npm CLI and must not be described as `npx beeui` yet.

Current repository-local entry points:

```sh
pnpm beeui -- help
pnpm beeui -- init
pnpm beeui -- list
pnpm beeui -- add button
pnpm beeui -- add --dry-run button
pnpm beeui -- doctor
pnpm registry:verify
pnpm registry:test
```

The workflow copies supported BeeUI source into a consumer project. The consumer then owns those copied files. It does not create a dependency from the consumer back to this monorepo, does not install packages automatically, and does not fetch executable remote code.

## Supported registry entries

Registry coverage has expanded from the initial 6-component slice to the full stable public component-module surface exported by `packages/ui/src/index.ts` (**56 public component modules** as of this writing). Run `pnpm beeui -- list` for the canonical, sorted, up-to-date list — it is generated from `registry/registry.json`.

`pnpm registry:verify` additionally compares those public `./components/*` barrel exports with public registry component entries. Adding or removing a public component module without updating the registry therefore fails CI instead of silently allowing registry coverage to drift.

Internal transitive entries (not directly addable, but resolved automatically):

- `core-cn` — the `cn` helper required by most components (single-symbol `@beeui/core` import)
- `field-context` — the field context required by `input`/`field`
- `form-group-context` — the form-group context required by `form-group`/`radio`
- `use-required-callback-warning` — the dev-mode controlled-usage warning shared by `checkbox`, `radio`, `segmented-control`, `switch`, `tabs`
- `core-overlay` — a copy of `@beeui/core`'s cn/anchored-overlay/overlay-runtime utilities, used by components whose `@beeui/core` import mixes `cn` with anchored-overlay types/functions (`popover`, `dropdown-menu`, `select`, and the `overlay-runtime` utility itself)
- `overlay-runtime` — the shared anchored-overlay runtime/transport kernel (`overlay-runtime.tsx` plus its platform transport/dismiss-event files), required by `dialog`, `popover`, `dropdown-menu`, `select`, and `safe-area`

`button` remains a representative vertical slice. Adding it resolves and copies `core-cn`, `theme`, `text`, and `button` in deterministic dependency order. The resulting Button source imports the copied consumer-local `cn` helper rather than `@beeui/core`.

`popover` (or `dropdown-menu`/`select`) is the representative anchored-overlay slice: it resolves `core-cn -> theme -> text -> button -> core-overlay -> overlay-runtime -> popover`, and its `@beeui/core` import is rewritten to point at the copied `core-overlay` barrel (`lib/core/index`) via the `rewrite-beeui-core-module` transform (see below).

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

The config is versioned and deterministic. Configured paths must be project-relative forward-slash paths. Absolute paths, `..`, empty path segments, Windows absolute paths, and traversal outside the project root are rejected.

`init` never silently replaces an existing config. If a valid config already exists it reports that nothing changed. A malformed or unsupported existing config fails non-zero.

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
    "react-native": ">=0.86.0"
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

External packages are not mutated automatically. The CLI reports required package names/ranges and whether each package name is already declared in the consumer's `package.json`. It does not currently perform semver satisfaction analysis and does not run npm, pnpm, yarn, bun, or another package manager.

Depending on the requested items, reported requirements can include:

- `class-variance-authority@0.7.1`
- `clsx@2.1.1`
- `tailwind-merge@3.6.0`
- `react@>=19 <20`
- `react-dom@>=19 <20`
- `react-native@>=0.86.0`
- `react-native-safe-area-context@>=5 <6`
- `react-native-teleport@>=1.1 <2`
- `tailwindcss@>=4 <5`
- `uniwind@>=1.10.1 <2`

`react-dom`, `react-native-safe-area-context`, and `react-native-teleport` are only reported for items that resolve the `overlay-runtime`/`safe-area`/`toast` utilities (anchored overlays and the app-root provider); plain components never pull them in. A successful source copy therefore does not mean external packages are fully installed.

These ranges are the declared public promise; `docs/compatibility-matrix.md` is the authority for which point in each range has actually been tested and which parts of the range remain an unverified candidate pending R2 (#130–#135).

## Import transforms

Two narrow source transforms are supported: `rewrite-beeui-core-cn` and `rewrite-beeui-core-module`.

Most component source contains the exact single-symbol import:

```ts
import { cn } from '@beeui/core';
```

`rewrite-beeui-core-cn` rewrites that exact import to the relative path of the copied `core-cn` destination in the consumer project. The transform fails if the expected import appears zero times or more than once, which makes upstream source drift visible instead of applying a broad regex heuristic.

A smaller set of files (`popover`, `dropdown-menu`, `select`, and the internal `overlay-runtime` utility) import multiple symbols from `@beeui/core` in one statement — `cn` alongside anchored-overlay types/functions, or anchored-overlay types/functions alone. `rewrite-beeui-core-module` rewrites only the `'@beeui/core'` module specifier itself (not the imported symbol list) to the relative path of the copied `core-overlay` barrel (`lib/core/index`), which re-exports the same `cn`/anchored-overlay/overlay-runtime surface from mirrored, self-contained copied source. The transform fails the same way if the specifier appears zero times or more than once in the file.

Other imports are copied unchanged. Relative component imports such as `./text` and `./field-context` remain valid because those dependencies are explicitly represented in the registry and copied into the same configured components directory.

Copied output is tested to contain no `workspace:*` references, no `@beeui/*` runtime imports, and no references back into monorepo `packages/` paths.

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

This validates the canonical registry, the local `beeui.config.json`, configured path boundaries, and practical symlink constraints. It does not add components.

Repository maintainers can validate the canonical registry independently of any consumer project with:

```sh
pnpm registry:verify
```

## Security boundaries

The current repository-local workflow deliberately keeps the trust surface small:

- Node.js built-ins implement CLI parsing and filesystem behavior.
- Registry data is JSON, not executable code.
- No `eval`, `Function`, shell-string interpolation, arbitrary registry commands, telemetry, auth, or remote code fetch exists.
- Registry and config paths reject absolute paths and traversal.
- Existing symlink path segments are rejected for consumer destinations and canonical registry sources.
- Registry source realpaths are checked to remain within the repository.
- Consumer destinations are resolved and checked to remain within the selected project root.
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
- no `workspace:*` / `@beeui/*` / monorepo package imports in copied output
- TypeScript/TSX transpile syntax smoke
- copied relative-import graph resolution
- no partial writes after preflight collision
- anchored-overlay module rewrite via Popover
- doctor behavior

The root `pnpm test` command also runs `pnpm registry:verify` and `pnpm registry:test` after the existing showcase test suite.

## Why there is no public `npx beeui` yet

This tranche intentionally avoids creating `packages/cli`, publishing a fourth package, or changing the current release contract. The CLI remains an internal/pre-1.0 repository tool while the registry/data model, source transforms, security behavior, and consumer workflow stabilize.

Do not document or advertise `npx beeui` as available until a later release tranche owns package naming, npm publication, binary metadata, versioning, distribution, and release verification.

## Roadmap

A later CLI publication tranche can:

1. decide the publishable CLI package/binary name and release contract;
2. move the stable engine behind that package without changing registry semantics;
3. add semver-aware external dependency checks and, only with a separate explicit contract, safe package-manager mutation;
4. define remote registry distribution with integrity/version controls if BeeUI needs it;
5. expand source transforms only when each transform has drift/error tests.

The registry should stay in lockstep with the stable public component-module surface. `pnpm registry:verify` enforces that invariant; new components must declare their exact source files, internal registry dependencies, external packages, peer expectations, and required transforms before their public export can land. Components with more complex native dependencies or provider/context behavior still need consumer verification appropriate to their runtime contract.
