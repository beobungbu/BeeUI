---
"@beemvp/beeui-ui": patch
---

Fix RC3 consumer-facing regressions and accessibility gaps: remove SegmentedControl's persistent hidden Web label clone, preserve SafeArea child flex/gap/alignment semantics when caller padding is composed with safe-area insets, expose checked DropdownMenu items as `menuitemcheckbox`/`menuitemradio` with checked state on Web, and suppress the controlled-Switch callback warning when a parent Field already disables the control.
