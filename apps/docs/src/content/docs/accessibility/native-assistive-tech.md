---
title: VoiceOver & TalkBack
description: Understand BeeUI native assistive-technology expectations and the evidence boundary.
---

BeeUI components expose React Native accessibility roles, labels, states and announcements
appropriate to their contracts. That deterministic structure is necessary but does not
prove how every combination behaves under a live screen reader.

For release-quality native claims, representative flows are exercised with real
simulator/emulator/device runtime evidence where the repository records it. A Web axe scan,
Jest tree or successful iOS/Android compile must not be reported as VoiceOver/TalkBack proof.

When integrating BeeUI, verify your own screen composition: heading/reading order, modal
boundaries, focus after dismissal, error/live announcements, large text and any
application-owned navigation semantics can change the experience even when each primitive
is correct in isolation.

## Task: verify one screen with a real screen reader

1. iOS: Settings → Accessibility → VoiceOver → On (or triple-click the side button if you
   have that shortcut configured). Android: Settings → Accessibility → TalkBack → On.
2. Swipe right (iOS) or right (Android, in linear navigation) from the top of your screen and
   confirm every interactive element is announced in the same order a sighted user would read
   it, with a role (button, link, header) and, for a control with state, that state (e.g.
   "switch, on").
3. Activate one overlay-opening control (`Dialog`, `Sheet`, `Select`, `DropdownMenu`) with the
   screen reader's activation gesture. Confirm the screen reader announces entering the
   overlay, and that dismissing it (its close control or the platform back gesture) returns
   focus and announcement to the triggering element — not silently to the top of the screen.
4. For a form field with an error, confirm the error text is announced when the field
   receives focus or immediately after validation runs, not only when visually revealed.
5. Enable the largest system text size (iOS: Settings → Accessibility → Display & Text
   Size → Larger Text; Android: Settings → Accessibility → Font size) and repeat step 2 —
   confirm no announced label is truncated or missing.
6. Record what you tested (device/OS version, screen, gesture) — a Web axe scan, Jest render
   tree or a successful compile is not a substitute for this pass; see the evidence-boundary
   note above.

Sources: [VoiceOver matrix](https://github.com/beobungbu/BeeUI/blob/main/docs/voiceover-release-matrix.md), [TalkBack matrix](https://github.com/beobungbu/BeeUI/blob/main/docs/talkback-release-matrix.md), and [native runtime smoke](https://github.com/beobungbu/BeeUI/blob/main/docs/native-runtime-smoke.md).
