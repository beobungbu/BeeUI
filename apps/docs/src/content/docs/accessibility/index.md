---
title: Accessibility
description: Consumer-facing semantics, keyboard, large-text, localization, motion and native assistive-technology expectations.
---

# Accessibility

Accessibility is part of BeeUI's component behavior contract, not a visual add-on. Use
semantic labels/descriptions/states, preserve focus order, keep touch targets usable, and
let text/control surfaces grow under Dynamic Type or Web zoom.

## Task guides

- [Keyboard & focus](/docs/accessibility/keyboard-focus/)
- [RTL & localization](/docs/accessibility/rtl/)
- [Large text & zoom](/docs/accessibility/large-text/)
- [Reduced motion](/docs/accessibility/reduced-motion/)
- [VoiceOver & TalkBack expectations](/docs/accessibility/native-assistive-tech/)

Overlays need special attention: modal surfaces own a modal accessibility boundary while
anchored overlays participate in the nearest overlay scope; Escape/back/outside-press and
focus restoration follow each component contract rather than a one-size-fits-all rule.
Status/Toast surfaces use live announcements where the component contract requires them.

Automated browser scans, Jest semantics, native compilation and device assistive-technology
runs prove different things. BeeUI never treats an automated scan as accessibility
certification or a native compile as VoiceOver/TalkBack runtime proof.

Canonical sources: [accessibility contract](https://github.com/beobungbu/BeeUI/blob/main/docs/accessibility-contract.md), [keyboard/focus matrix](https://github.com/beobungbu/BeeUI/blob/main/docs/keyboard-focus-acceptance-matrix.md), and [Web audit](https://github.com/beobungbu/BeeUI/blob/main/docs/web-accessibility-audit.md).
