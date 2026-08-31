---
title: Patterns
description: Production screen patterns built from BeeUI primitives.
---

BeeUI includes a 37-screen production Pattern Gallery spanning Authentication +
Onboarding, Dashboard + Finance, Commerce + Social, and Account + Settings packs.

The production pattern library ([#223](https://github.com/beobungbu/BeeUI/issues/223))
documents all 37 screens: for each screen it records purpose, state contract,
composition, the callback ownership boundary, responsive and accessibility guidance,
source-ownership guidance, and the application logic intentionally left to the caller —
with every entry linking to its executable, typechecked source in the Pattern Gallery:

- `docs/pattern-library.md` — the generated production pattern library.
- `apps/showcase/patterns/**` — the executable Showcase screen sources.

The patterns are original BeeUI compositions built only from public `@beemvp/beeui-ui`
components; BeeUI owns no routing, data, or backend behind them.
