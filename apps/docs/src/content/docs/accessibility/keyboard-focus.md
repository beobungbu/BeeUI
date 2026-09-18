---
title: Keyboard & focus
description: Keep BeeUI controls operable and focus-visible across Web and native keyboard flows.
---

Keyboard navigation and focus order are part of the component contract. Use the component's
semantic trigger/control rather than wrapping it in a second clickable surface. On Web,
interactive controls must be reachable by keyboard in logical focus order, show visible
focus, and support the keyboard keys appropriate to their role. Dialog/Popover/Select/
DropdownMenu/Sheet each have their own open/dismiss/focus-return behavior.

For forms, keep labels and errors associated with the interactive control; `KeyboardAwareScreen`
solves viewport/keyboard composition but does not own validation or form state. Test with
actual Tab/Shift+Tab and Escape, not only pointer clicks.

Native hardware keyboard/focus behavior is platform runtime behavior; compile success alone
is insufficient evidence.

## Task: verify one screen's keyboard/focus path

1. Load the screen in a desktop browser (Web target) with the mouse unplugged or ignored.
2. Press Tab repeatedly from the top of the page. Confirm the order matches the screen's
   visual reading order — every interactive control (buttons, inputs, `DropdownMenu`/
   `Select` triggers, `Sheet`/`Dialog` triggers) must be reachable, and nothing focusable is
   skipped or reachable twice.
3. At each stop, confirm a visible focus indicator is present — if you cannot tell which
   element has focus by looking at the screen alone, that is a failure.
4. Open one overlay (`Dialog`, `Sheet`, `Popover`, `DropdownMenu`, or `Select`) via keyboard
   (Enter/Space on its trigger). Confirm focus moves inside the overlay, Escape closes it, and
   focus returns to the trigger that opened it — not to the top of the page.
5. For a screen with a form, Tab through every field and confirm each field's label,
   description and error (if any) are announced together, not just the bare input.
6. Repeat steps 2–4 with a real hardware keyboard on an iOS/Android device or simulator if the
   screen ships natively — Web keyboard behavior does not prove native keyboard behavior.

See [keyboard/focus acceptance](https://github.com/beobungbu/BeeUI/blob/main/docs/keyboard-focus-acceptance-matrix.md), [anchored overlays](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md), and [Component reference](/docs/components/).
