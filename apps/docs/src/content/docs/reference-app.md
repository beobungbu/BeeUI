---
title: Production reference app
description: See BeeUI inside one coherent routed support-workspace application.
---

# Production reference app

**[Open the live reference app](/demo/)** to see BeeUI used as a consumer would use it: one
routed Expo application with its own navigation, mock service layer, feature state and
responsive shell.

This is intentionally different from two other surfaces:

- **Component reference** explains one public family and its contracts.
- **Pattern Gallery** demonstrates reusable controlled screen compositions.
- **Production demo** owns application routing and feature orchestration to show how those pieces fit together.

## Product flow

The current app includes Dashboard, Records, Record Detail/Edit, Schedule and Settings.
Records use the same committed ticket fixture for the table and detail routes, including
public static deep links such as `/demo/records/TCK-10482/` in the launch build.

The app deliberately uses replaceable mock services. It does **not** imply that BeeUI owns
backend APIs, authentication, persistence, billing, routing or business rules.

## Public Web build

```bash
pnpm --filter @beemvp/beeui-demo build:web:public
```

The public build turns on Expo Router static output plus `/demo` `baseUrl`. Dynamic ticket
routes are generated from `getAllTickets()` so the deploy route set cannot silently drift
from the demo fixture. The ordinary `build:web` remains the existing root-hosted engineering
export.

## Source

- [`apps/demo`](https://github.com/beobungbu/BeeUI/tree/main/apps/demo)
- [`tickets-data.ts`](https://github.com/beobungbu/BeeUI/blob/main/apps/demo/src/features/records/tickets-data.ts)
- [`Record detail route`](https://github.com/beobungbu/BeeUI/blob/main/apps/demo/app/(tabs)/records/%5Bid%5D/index.tsx)

The public Web shell adds a lightweight return bar to Docs, Showcase and BeeUI Home. Native
keeps the accepted app shell unchanged.
