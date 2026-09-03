---
title: Reduced motion
description: Respect reduced-motion preferences while preserving state changes and feedback.
---

# Reduced motion

Motion may clarify state but must not be required to understand or operate a BeeUI flow.
When the platform reports a reduced-motion preference, decorative/transitional animation
should reduce or disappear while state, focus, loading and success/error feedback remain
available.

Do not replace an animation with an invisible state change: preserve semantic announcements
and final visual state. Application-owned animation around BeeUI components must follow the
same policy.

The public landing also respects the browser `prefers-reduced-motion` preference.

Canonical source: [reduced-motion acceptance matrix](https://github.com/beobungbu/BeeUI/blob/main/docs/reduced-motion-acceptance-matrix.md) and [motion contract](https://github.com/beobungbu/BeeUI/blob/main/docs/motion.md).
