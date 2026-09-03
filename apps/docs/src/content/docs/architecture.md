---
title: Architecture & design principles
description: Understand BeeUI's mobile-first scope, semantic contracts, distribution choices and application ownership boundaries.
---

# Architecture & design principles

BeeUI is a mobile-first React Native UI system that treats Expo, bare React Native and Web
as real targets while keeping behavior APIs independent from an app router, backend or form
framework.

## Stable layers

- **Core** — engine-neutral utilities/contracts.
- **Tokens** — semantic theme, density and responsive values.
- **UI** — React Native component behavior/presentation built on those contracts.
- **Registry/source ownership** — optional delivery model for teams that want to own and edit source.
- **Showcase/Patterns/Demo** — evidence/reference applications, not runtime dependencies of your app.

## Boundaries that matter

Components use semantic tokens instead of brand literals. Modal-class surfaces (Dialog/
AlertDialog/native Sheet) and anchored overlays (Popover/DropdownMenu/Select/Tooltip) use
intentionally different runtime primitives. Applications own routing, data/auth/business
logic and persistence. BeeUI does not build those systems merely to appear “complete”.

Package consumption centralizes updates; source ownership trades centralized upgrades for
local control. Both models preserve the same public component behavior contract.

The internal “Rule of Two” is a contributor heuristic for promoting repeated product needs
into shared primitives; consumers do not need it to operate BeeUI.

Sources: [architecture](https://github.com/beobungbu/BeeUI/blob/main/docs/architecture.md), [distribution ADR](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md), and [component catalog](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md).
