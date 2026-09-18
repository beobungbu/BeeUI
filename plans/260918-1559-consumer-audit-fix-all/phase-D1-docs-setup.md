# WS-D1 · docs: start, config, styling, theming, tokens, compat pins

Owned: apps/docs/src/content/docs/{start,theming,compatibility,guides}/**, apps/docs/src/content/docs/index.md, examples/** (starter pins), README.md version strings, docs/compatibility-*.md if present, packages/*/package.json only for peer/version metadata named in issues. Do NOT touch packages/ui/src.

Issues (read each with `gh issue view N --repo beobungbu/BeeUI`):
- #575 Web start "Vite configuration" section is empty → write the real config (from examples/web-consumer), including Tailwind/Uniwind wiring, so a fresh reader gets a styled app.
- #576 Start page: add project-creation step, fix Web install order (ERESOLVE), Expo provider example must respect expo-router root layout.
- #577 Styling entry: state the CSS file location before @source paths; give paths relative to that file.
- #583 Config: Troubleshooting metro fragment and Theming CSS block must match a working app config (wrapper, path, @source).
- #581 Branding "Register a brand of your own" example throws Uniwind not-registered → fix example to register before use; remove "packages unpublished" statement.
- #609 Theming: document Uniwind.setTheme('system') semantics and how to resume following the OS after an explicit theme (verify in code; if it truly does not resume, add a documented helper in docs only, and file note in report).
- #545 Document system theme preference and restore semantics (llm + human docs).
- #547 Web onboarding vs provider/safe-area guide contradict on root SafeArea → make one canonical statement, cross-link.
- #562 Expo: fresh checkout fails tsc until `uniwind generate-artifacts` → document the step in start + contributing.
- #594 Tokens: chart token path is `chart.series-1` not `colors.chart-series-1` → fix docs; add test in scripts/__tests__ if a docs-check covers token paths.
- #599 Typography: say the type scale is reachable only via Text variant, not text-<step> classes; show mapping table.
- #544 Expo starter pins metro-runtime below Expo 57 peer floor → bump in examples starter and compat matrix.
- #566 items 1,2,4: Compatibility page lists all declared peers; explain RN 0.86.2 vs 0.86.3 pin; unify version strings across README/workspace/npm (document the scheme).
- #543 AI-agent cookbook must match current npm publication status (RC on `next`; check `npm view @beemvp/beeui-ui dist-tags`).

Checks: `pnpm docs:public-truth:check && pnpm site:contract:check && pnpm docs:foundation:check && pnpm docs:examples:check && pnpm compat:check && pnpm docs:contract:check`. Verify every code block you write actually matches examples/ config files.
