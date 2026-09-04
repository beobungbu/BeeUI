---
title: Keyboard & focus
description: Keep BeeUI controls operable and focus-visible across Web and native keyboard flows.
---

# Keyboard & focus

Use the component's semantic trigger/control rather than wrapping it in a second clickable
surface. On Web, interactive controls must be reachable in logical order, show visible
focus, and support the keyboard keys appropriate to their role. Dialog/Popover/Select/
DropdownMenu/Sheet each have their own open/dismiss/focus-return behavior.

For forms, keep labels and errors associated with the interactive control; `KeyboardAwareScreen`
solves viewport/keyboard composition but does not own validation or form state. Test with
actual Tab/Shift+Tab and Escape, not only pointer clicks.

Native hardware keyboard/focus behavior is platform runtime behavior; compile success alone
is insufficient evidence.

See [keyboard/focus acceptance](https://github.com/beobungbu/BeeUI/blob/main/docs/keyboard-focus-acceptance-matrix.md), [anchored overlays](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md), and [Component reference](/docs/components/).
