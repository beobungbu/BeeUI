---
title: Accessibility
description: Accessibility, RTL, and large-text behavior across BeeUI.
---

Accessibility, RTL, large text, high contrast, and reduced motion are part of BeeUI's
definition of component correctness, not an add-on. This page is the entry point into
BeeUI's accessibility documentation contract; the full, per-component breakdown (roles/
states, labels, keyboard behavior, platform differences, RTL, Dynamic Type, reduced
motion, assistive-technology expectations, and known limitations) lives in
`docs/accessibility-contract.md` in the source repository.

## What BeeUI guarantees today

- **No component disables platform text scaling.** iOS/Android Dynamic Type and browser/
  OS text-size preferences always reach BeeUI text; see [Large text & zoom](/accessibility/large-text/).
- **No component owns a second RTL, theme, or motion state engine.** Direction, theme, and
  motion preferences are read from the platform's own authority and forwarded, never
  duplicated; see [RTL & localization](/accessibility/rtl/).
- **Keyboard and focus behavior is verified with real, keyboard-driven browser tests**
  (never a `.focus()`/synthetic shortcut) across Forms, Buttons/Links, Tabs, menus,
  Select, Tooltip, Dialog/AlertDialog, Sheet, Table, and Calendar/DatePicker/
  DateTimePicker — full matrix in `docs/keyboard-focus-acceptance-matrix.md`.
- **Web pages are scanned with automated axe-core accessibility checks** as part of CI;
  see `docs/web-accessibility-audit.md`.
- **Disabled and loading states are real**, not visual-only: they are skipped by keyboard
  navigation and exposed through actual accessibility state, not merely dimmed color.

## What BeeUI does not yet claim

Read these limitations before treating any component as certified:

- **No assistive-technology (VoiceOver/TalkBack) interaction evidence exists yet** for any
  component. Every native accessibility claim today is deterministic-contract evidence
  (the component requests the correct React Native accessibility props/roles/labels in a
  test) — not a recording of a real screen reader announcing them correctly. The tracked,
  currently open work that will add that evidence is BeeUI issues #147 (VoiceOver) and
  #148 (TalkBack).
- **RTL and reduced motion are implemented and exercised per-component**, but neither has
  a single cross-cutting acceptance matrix yet the way keyboard/focus does — see the
  linked pages for what is actually covered today.
- **Automated Web accessibility scanning does not certify full WCAG conformance.** Several
  success criteria require human judgment axe-core cannot automate.

## Pages

- **[RTL & localization](/accessibility/rtl/)**
- **[Large text & zoom](/accessibility/large-text/)**

:::note[Content pending]
A dedicated per-component keyboard/screen-reader reference page (mirroring
`docs/accessibility-contract.md`'s per-component sections for Tooltip, Sheet, Table,
Calendar/DatePicker/DateTimePicker, and the rest of the component catalog) is tracked for
a follow-up docs content issue once the per-component API reference pages (#221) exist to
link against.
:::
