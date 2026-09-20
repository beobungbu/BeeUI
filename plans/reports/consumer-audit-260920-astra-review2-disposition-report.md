# Disposition of Astra's deep review #2 (received 2026-09-20 18:27)

Review: plans/reports/from-astra-260920-1827-deep-review-report.md. Every finding was verified against source before work was assigned; none was rejected this round.

| # | Finding | Fix | Where | Proof |
|---|---|---|---|---|
| 1 | Masked password exposed via `accessibilityValue.text` | Automatic value omitted when `secureTextEntry`; explicit caller value still wins | WS-P → #617 (4ac5257) | jest: PasswordInput in Field masked → no text; shown → text |
| 2 | SafeArea strips a safe edge when className has padding | Redesigned: outer element keeps all insets, caller padding applied on an inner wrapper (only when padding present); regex removed | WS-P → #617 | jest geometry with mocked inset top=47 + `pt-6` → 47 + 24; `md:pt-6` never removes an edge; old edge-stripping tests deleted (documented) |
| 3 | ToolbarItem `onPress/disabled/className` ignored in visible mode | ToolbarItem metadata authoritative in both modes (child onPress wins if set, dev warning when both differ) | WS-Q → #618 | jest without duplicating props on the child |
| 4 | Overflow math: 36px constant, no gaps | Measured trigger width via onLayout (fallback icon token), shared gap constant used by className and math | WS-Q → #618 | threshold tests: exact fit, +1px, trigger measured 44 |
| 5 | IconButton always wrapped in `View self-start`; sm min-width; custom count aria-hidden | Button rendered directly without `count`; badge wrapper forwards className/style; sm gets min-w touch target; custom node no longer forced aria-hidden | WS-P → #617 | jest |
| 6 | Table Web interactive selector incomplete | Full interactive set (elements + 17 roles + tabindex) | WS-Q → #618 | Playwright real DOM 48/48: Button, Checkbox, Radio, SelectTrigger, Link inside a pressable row |
| 7 | dist-tag causal claim unsupported | Policy states the observation only; mechanism explicitly "not established" | 7d1fa97 on #618 | dist-policy / release-control-plane / public-truth / llms / ai-contract checks green |
| 8 | DatePicker/DateTimePicker limitation text and docs/components.md stale | Rewritten; components.md updated for Screen, IconButton, Toolbar, Tabs, Table, SafeArea, SearchInput, Chip, ListItem | WS-Q → #618 | docs gates green |
| 9 | Select `scrollViewProps` type vs Web View | Split: `scrollViewProps` native-only, `listProps` Web-only; JSDoc + page updated | WS-Q → #618 | type-level test |
| 10 | Sheet multi-dismiss aliasing | Pending dismiss generations tracked as a Set | WS-Q → #618 | jest: open/close ×2 with two out-of-order delayed onDismiss |

Still open (owner / #619): real-device #584, Android sheet runtime smoke, native runtime lanes are label-gated (`ci:native`) on PRs, #619 architecture before stable.

Observation for the docs process (from finding 8): freshness gates prove regeneration, not truth; a stale sentence in hand-authored content survives every regeneration. WS-Q's optional guard for contradicted "Limitations" claims was not built; it stays a candidate follow-up.
