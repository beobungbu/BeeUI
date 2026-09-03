---
title: VoiceOver & TalkBack
description: Understand BeeUI native assistive-technology expectations and the evidence boundary.
---

# VoiceOver & TalkBack

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

Sources: [VoiceOver matrix](https://github.com/beobungbu/BeeUI/blob/main/docs/voiceover-release-matrix.md), [TalkBack matrix](https://github.com/beobungbu/BeeUI/blob/main/docs/talkback-release-matrix.md), and [native runtime smoke](https://github.com/beobungbu/BeeUI/blob/main/docs/native-runtime-smoke.md).
