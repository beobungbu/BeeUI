# WS-D1 docs: start/config/styling/theming/tokens/compat pins — report

Branch: `ws/d1-docs-setup`, based on `fix/consumer-audit-batch` (`e437553`), commits
`dde44af` and `baad22d`.

Note on base: the assigned worktree's checked-out branch did not contain the plan files
(`plans/260918-1559-consumer-audit-fix-all/**`), which only exist on `fix/consumer-audit-batch`
(a local branch, no remote ref). `ws/d1-docs-setup` was created from `fix/consumer-audit-batch`
directly so the phase spec and plan were reachable; flagging in case the integration branch
naming differs from what other workstreams assume.

## Per-issue status

| Issue | Status | Notes |
| --- | --- | --- |
| #575 Vite config empty | Fixed | `start/web.md` now has the real `examples/web-consumer/vite.config.ts` content, full GitHub link, plugin-order explanation, and a "how to tell it worked" CSS check. |
| #576 no project-creation step / ERESOLVE / expo-router provider | Fixed | Added "Create the project" steps to `web.md`/`expo.md`/`bare-react-native.md`; combined BeeUI + peer installs into one `npm install` on all three start pages; `expo.md`'s Provider section now shows `app/_layout.tsx` + `Stack` as the primary example, bare `App()` as the alternative. |
| #577 @source paths without file location | Fixed | `web.md`, `expo.md`, `bare-react-native.md`, `theming/index.md` all state where the CSS file lives before the `@source` block and explain the path is relative to that file. |
| #583 Metro/CSS fragments don't match a working app | Fixed | Troubleshooting's Metro fragment now shows the full `require`/`module.exports` wrapper; Theming's Web CSS block is now the complete 5-line block (base imports + both `@source` lines), matching Start/Troubleshooting. |
| #581 Branding registration example throws | Fixed | Added the missing `extraThemes` Metro/Vite config step and the paired `@custom-variant`/`@variant` theme CSS block before the `setTheme` call; removed the stale "packages are not published to npm yet" line. |
| #609 `setTheme('system')` resume semantics | Documented (not code-fixed — out of ownership) | `packages/ui/src/components/theme-scope.tsx` confirms BeeUI has no wrapper around `Uniwind.setTheme`; it is a pure re-export, so this cannot be fixed from docs-owned files or `packages/ui/src`. Verified via `docs.uniwind.dev` that `setTheme('system')` is *documented* to resubscribe; the issue's field evidence says it does not at pinned `uniwind@1.10.1`. Documented the observed gap plus a copy-pasteable workaround (`useSyncExternalStore` + `matchMedia` on web, `useColorScheme` on native, guarded `Appearance.setColorScheme`) in `theming/index.md`, per the spec's docs-only fallback instruction. |
| #545 system/light/dark LLM+human docs | Partially fixed | Human-facing `theming/index.md` now documents the `'system' \| 'light' \| 'dark'` contract, restore semantics, and the `BeeThemeScope` vs. app-preference distinction. The LLM-generator/`docs/ai-agent-cookbook.md`/`llms*.txt` acceptance items are explicitly excluded from D1 ownership ("ai docs pages... llms*.txt — another workstream owns them") — **needs D2 or a dedicated LLM workstream** to regenerate `llms-full.txt` and fix `docs/ai-agent-cookbook.md`'s light/dark-only framing. |
| #547 Web vs. provider-guide SafeArea contradiction | Fixed | `start/web.md`'s Application root now uses ordinary layout (no `SafeArea`), matching the real `examples/web-consumer/src/App.tsx` and `provider-safe-area.md`'s existing claim. `provider-safe-area.md`'s Root setup section now explicitly scopes itself to Expo/bare RN and links to Web's canonical root. |
| #562 `uniwind generate-artifacts` undocumented | Fixed | New "Generate Uniwind's TypeScript artifacts before typechecking" section in `expo.md` with the CLI invocation and a `postinstall`/`typecheck` package.json snippet, matching BeePOS's shipped workaround. |
| #594 `colors.chart-series-1` vs `chart.series-1` | Partially fixed | Added a "Chart token paths" section to `theming/index.md` with the correct `chart.series-1` form and the full 10-name list. The primary defect (`apps/docs/src/content/docs/reference/tokens.md`) and `components/use-bee-token.md` are under `reference/`/`components/`, explicitly excluded from D1 — **needs D2**. |
| #599 typography scale via `variant`, not `text-<step>` | Partially fixed | Added a "Typography scale" section to `theming/index.md` with the `variant` prop table and the arbitrary-value fallback for plain RN `Text`. The primary pages (`reference/tokens.md`, the `Text` component page under `components/`) are excluded from D1 — **needs D2**. The unrelated note in #599 about Tailwind's project-wide scanner picking up markdown-file utility-shaped strings is not addressed; it names no specific doc page and would need a `scripts/`-level `@source not` fix outside docs ownership. |
| #544 Expo metro-runtime below peer floor | Fixed | `examples/expo-package-consumer/package.json` + `setup.sh`: `@expo/metro-runtime` `57.0.14` → `57.0.16` (satisfies the real `@expo/cli@57.0.23`/`@expo/router-server@57.0.9` peer floor `^57.0.15`, confirmed via `npm view`), `react-native` `0.86.2` → `0.86.3`. `docs/compatibility-matrix.md` gets a new "Expo consumer-starter pins vs. the repo-tested pin" section explaining this is a scoped starter exception, not a widened promise — the machine-checked snapshot block (repo's own tested `0.86.2`) is untouched. |
| #566 item 1 — peer table incomplete | Fixed | `compatibility/index.md` now has the complete `peerDependencies` table (12 entries, required/optional column), matching `npm view @beemvp/beeui-ui peerDependencies` exactly. |
| #566 item 2 — RN 0.86.2 vs 0.86.3 | Fixed | Same compat-matrix section as #544 explains the discrepancy explicitly. |
| #566 item 4 — three version strings | Fixed | Added a "Versioning policy" paragraph to `start/index.md` referencing ADR-015's decision (package version tracks its own release history; the `0.86.x` overlap with the React Native version is coincidental, not a rule). Checked for the specific stale strings named in the issue ("0.1.0" in README, "20260902.0.0" workspace version) — neither is present in README.md or any `package.json` today; only found in historical plan/report/ADR files, which are not live public surfaces. |
| #566 item 3 — `ListItem` active/selected prop | Not fixed — out of ownership | Component API gap in `packages/ui/src`, not docs. Needs WS-C (visual/API gaps) or a dedicated component-API workstream. |
| #566 item 5 — `OTPInput.onChange` shape | Not fixed — out of ownership | The OTP Input page lives under `components/`, excluded from D1. Needs D2. |
| #566 item 6 — `/sitemap-index.xml` empty | Not fixed — out of ownership | Site/infra issue (Worker routing), not a docs-content page under D1's ownership. |
| #543 AI-agent cookbook vs. npm RC status | Partially fixed | Verified real npm state: `npm view @beemvp/beeui-ui dist-tags` → `{"next":"0.86.2-rc.1","latest":"0.86.2-rc.1"}` (also true for `@beemvp/beeui-cli`); only one version (`0.86.2-rc.1`) has ever been published (`npm view ... time`). README.md's distribution-status line was already correct and needed no edit. Fixed the same class of stale "BeeUI is unpublished" claims in `guides/troubleshooting.md`'s caution banner (+ its "publication-truth check" entry) and `guides/branding.md`, plus every `examples/**` README/setup.sh/package.json that still said "unpublished". `docs/ai-agent-cookbook.md` and `llms*.txt` are explicitly excluded from D1 ownership and still say BeeUI is unpublished/404 — **needs D2 or an LLM-surface workstream** to fix and regenerate. |

### New finding requiring owner attention (not a D1 fix)

Real npm registry state (`npm view @beemvp/beeui-ui dist-tags`, `npm view ... time`) shows
`latest` already resolves to `0.86.2-rc.1`, identical to `next`, because only one version has
ever been published and npm always points a package's first-ever published version at `latest`
regardless of the `--tag` used at publish time. This contradicts `docs/dist-tag-policy.md`'s
stated invariant ("Stable `latest` must not point to this prerelease... never points to a
prerelease") and README's "stable `latest` is not promoted yet" framing. I did not change
`docs/dist-tag-policy.md` or README's dist-tag wording — that file is the release-control-plane
authority (out of D1 ownership) and this is exactly the plan's already-deferred owner-gate item
(`#561 npm dist-tag "latest" → needs npm publish rights (owner)`). Flagging as confirmed
evidence: a bare, unqualified `npm install @beemvp/beeui-ui` today actually installs the RC,
which is likely unintended and needs an owner npm dist-tag correction.

## Pages changed

- `apps/docs/src/content/docs/start/web.md`
- `apps/docs/src/content/docs/start/expo.md`
- `apps/docs/src/content/docs/start/bare-react-native.md`
- `apps/docs/src/content/docs/start/provider-safe-area.md`
- `apps/docs/src/content/docs/start/index.md`
- `apps/docs/src/content/docs/theming/index.md`
- `apps/docs/src/content/docs/compatibility/index.md`
- `apps/docs/src/content/docs/guides/troubleshooting.md`
- `apps/docs/src/content/docs/guides/branding.md`
- `docs/compatibility-matrix.md`
- `examples/README.md`, `examples/web-consumer/{README.md,setup.sh,src/App.tsx}`,
  `examples/expo-package-consumer/{README.md,setup.sh,package.json}`,
  `examples/bare-rn-consumer/README.md`, `examples/source-ownership-starter/{README.md,setup.sh}`,
  `examples/demo-reproduction-records/{README.md,package.json}`,
  `examples/agent-reference-app/README.md`, `examples/scripts/pack-beeui-packages.mjs`

No changes were made to `packages/*/package.json` dependency pins (peer ranges already cover
the versions used) or to any `reference/`, `components/`, `patterns/`, `learn/`, `ai/` docs
page, or `llms*.txt`, per file ownership.

## Gate results (run from repo root; `npm_config_engine_strict=false` used only to work
around this sandbox's Node `v24.14.1` vs. the pinned `24.13.1`, not a docs change)

| Command | Result |
| --- | --- |
| `pnpm docs:public-truth:check` | PASS |
| `pnpm site:contract:check` | PASS |
| `pnpm docs:foundation:check` | PASS |
| `pnpm docs:examples:check` | PASS (236 docs scanned, 0 hallucinated imports) |
| `pnpm compat:check` | PASS |
| `pnpm docs:contract:check` | PASS |
| `pnpm compat:test` | PASS (10/10) |
| `pnpm docs:build` (run via `apps/docs` directly, engine-strict bypass) | PASS — 152 pages built, Pagefind index built, keyboard-scroll/page-budget/search-relevance/social-card checks in the build all passed |

`npm view @beemvp/beeui-ui dist-tags --json` / `peerDependencies --json` / `time --json` and
`npm view @beemvp/beeui-cli dist-tags --json` were run directly against the real npm registry
per the spec's #543 instruction (network access confirmed available in this environment).

## Items needing code changes or other-workstream ownership (not fixed here)

- `docs/ai-agent-cookbook.md` and the `llms*.txt` family still teach light/dark-only theming
  and still say BeeUI is unpublished/404 — needs regeneration once #545/#543's LLM-facing
  acceptance criteria are picked up (D2 or a dedicated LLM-surface owner).
- `apps/docs/src/content/docs/reference/tokens.md` and `components/use-bee-token.md` still
  print `colors.chart-series-1`-shaped guidance (#594); `components/text.md` and
  `reference/tokens.md` don't yet state the `variant`-only typography contract (#599) — D2.
- `ListItem` has no `active`/`selected` prop (#566 item 3) — component API work, not docs.
- `OTPInput`'s `onChange` event-shape documentation lives under `components/` (#566 item 5) — D2.
- `/sitemap-index.xml` returning empty at the site root (#566 item 6) — site/Worker infra, not
  a docs-content fix.
- `Uniwind.setTheme('system')` not resuming OS-follow after an explicit theme (#609) is a
  third-party (`uniwind` package) behavior gap BeeUI's own source does not wrap or own; only
  documented a workaround. If BeeUI wants to guarantee this contractually, it would need a
  BeeUI-owned wrapper in `packages/ui/src` (out of D1 ownership) or an upstream `uniwind` fix.
- The real npm `latest` dist-tag pointing at the RC (see "New finding" above) needs an owner
  decision/npm action; this reinforces the plan's already-deferred `#561`.
