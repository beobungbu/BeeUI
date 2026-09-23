# Astra deep independent review #2 — received 2026-09-20 18:27 (heads: #617 d28d8b9, #618 28d1787)

Verdict: both PRs REQUEST CHANGES; merge/RC/stable BLOCKED. Findings (all verified against source by the coordinator on 2026-09-20 unless noted):
1. MAJOR input.tsx/password-input.tsx: #614 fix injects `resolvedValue` into `accessibilityValue.text` whenever a label exists, including `secureTextEntry` → unmasked password exposed to assistive tech. Verified (input.tsx:113).
2. MAJOR safe-area.tsx: #598 fix removes a safe-area edge whenever `className` contains a padding utility (incl. `md:pt-6`), so the notch/status-bar inset disappears. Verified (safe-area.tsx:117).
3. MAJOR toolbar.tsx: `ToolbarItem.onPress/disabled/className` only applied in overflow mode, not to the visible child; tests duplicate props on the child. Verified (only overflow path uses item.onPress/disabled).
4. MAJOR toolbar.tsx: overflow budget reserves 36px while the trigger is `size="icon"` (44px) and `gap-1` between items is ignored. Verified (constant 36; sum without gaps).
5. MAJOR icon-button.tsx: every IconButton now renders inside `<View className="relative self-start">` even without `count`, changing the layout root; `size="sm"` only guarantees min height; custom `count` node is aria-hidden. Verified (icon-button.tsx:52).
6. MAJOR table.web.tsx: interactive-descendant selector misses radio, combobox, tab, option, menuitemcheckbox/radio, slider, spinbutton, textbox, searchbox, listbox. Verified.
7. MAJOR docs/dist-tag-policy.md: observation valid, causal mechanism ("registry requires latest") still unsupported. Accepted: state observation only.
8. MEDIUM DatePicker/DateTimePicker pages still say locale does not translate the placeholder; docs/components.md stale for Screen scroll, IconButton sizes, Toolbar.
9. MEDIUM select.tsx: `scrollViewProps` typed as ScrollViewProps but Web renders a View.
10. PLAUSIBLE sheet.native.tsx: single scalar dismiss generation may alias with two outstanding onDismiss callbacks.
Confirmed kept: Toolbar focusable sequence, packed-consumer theme-scope gate, single close→reopen race fix, Table Web guard. #619: A/B/C/D verdicts unchanged from review #1.
Disposition and fixes: WS-P (phase-P-batch-regressions.md, on fix/consumer-audit-batch) and WS-Q (phase-Q-followups-review2.md, on fix/consumer-audit-followups).
