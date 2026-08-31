---
title: Components
description: The BeeUI component catalog.
---

BeeUI's canonical component inventory spans layout, typography, action, form,
selection, navigation, disclosure, modal and anchored overlays, feedback, and
application-pattern components.

- **[Table](/components/table/)**
- **[Calendar & date/time](/components/calendar-date-time/)**

The per-component documentation contract ([#221](https://github.com/beobungbu/BeeUI/issues/221))
and executable-example enforcement ([#222](https://github.com/beobungbu/BeeUI/issues/222)) are
now generated from the stable component/registry surface. Every one of the 62 public
components carries the same required sections (purpose, import, API, source-ownership,
dependencies/provider, accessibility, platform, theme/density, behavior contract, and
executable examples), and CI fails if a new component ships without them:

- `docs/component-reference.md` — the generated per-component reference.
- `docs/component-documentation-contract.md` — the contract and how it is enforced.
- `docs/components.md` — the authoritative behavior catalog the reference links to.
