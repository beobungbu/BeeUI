# WS-B · web runtime, theme scope, tokens, input/select/sheet/safe-area, native keyboard

Owned files: packages/core/src/** (className/cn utilities), packages/ui/src/components: safe-area.tsx, input.tsx, search-input.tsx, textarea.tsx, select.tsx, sheet.web.tsx, sheet.native.tsx, sheet.tsx, use-bee-token.ts, theme-scope.tsx, app-header.tsx, keyboard-aware-screen.tsx, screen.tsx, text.tsx, otp-input.tsx. New tests in apps/showcase/__tests__/.

Issues (read each with `gh issue view N --repo beobungbu/BeeUI`):
- #563 className={cond ? "x" : undefined} throws styleq "typeof undefined" on web → fix at the shared className merge point so undefined/false/null entries are dropped for every component.
- #564 AppHeader inside partial-edge SafeArea throws styleq on mount (same root cause; add regression test with the provider-safe-area doc example).
- #598 SafeArea drops padding from className because inline inset style wins → merge, do not override.
- #606 focused Input/SearchInput stop keydown bubbling → must not stopPropagation; app-level shortcuts must keep working. Regression test.
- #614 Input with accessibilityLabel stops exposing typed value to VoiceOver (iOS) → do not set accessibilityValue/label in a way that hides value; verify via props snapshot test.
- #589 Input/SearchInput/AppHeader clip text at large Dynamic Type (fixed height/lineHeight) → use minHeight + scale-aware line height.
- #597 item 2: SearchInput trailing slot (`trailing` prop) and ref forwarding so `ref.current.focus()` works.
- #612 scrolling SelectContent swallows mouse presses on web (>~8 options cannot be picked) → fix pointer handling; test.
- #613 item 2: SelectValue renders nothing for empty-string value → show the matching option label or placeholder.
- #548 Sheet web: overlay + percentage snap geometry must use viewport height (window.innerHeight / 100dvh), not app-root height.
- #549 useBeeToken motion duration crashes on Web when Uniwind returns seconds ("0.2s") → parse s/ms robustly.
- #550 useBeeToken ignores BeeThemeScope in an external consumer; #552 BeeThemeScope does not scope semantic CSS variables in an external consumer (npm build, not monorepo alias). Read #551/#552 discussion; fix so packed package behaves.
- #588 KeyboardAwareScreen must scroll the focused input into view on iOS (not only pad).
- #597 item 4: Screen gains `scroll` prop (ScrollView container with keyboard handling) so long forms need no hand-rolled ScrollView.
- #590 item 5: Text.numeric invalid literal must not crash; fall back to default and warn in dev.
- #584 Sheet never presents on iOS in a real Expo 57 consumer (gorhom 5.2.14, reanimated 4.5.1, worklets 0.10.1). Investigate sheet.native.tsx against the issue evidence; fix if the cause is in BeeUI (e.g. present() before mount, missing BottomSheetModalProvider, index/snap mismatch). If not reproducible from code, write findings to plans/260918-1559-consumer-audit-fix-all/reports/ws-b-sheet-584.md and leave the issue open.

Rules: AGENTS.md. Jest tests in apps/showcase/__tests__ (see safe-area.test.tsx, keyboard-aware-screen.test.tsx, wave-2a-select.test.tsx, issue-72-token-reader.test.tsx, issue-68-theme-scope.test.tsx). Run `pnpm ui-exports:generate && pnpm ui-exports:check` if exports change.
