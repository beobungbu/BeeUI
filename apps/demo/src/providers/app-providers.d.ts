// Types-only module so `import { AppProviders } from './app-providers'` type-checks
// while Metro resolves the platform runtime (`app-providers.web.tsx` /
// `app-providers.native.tsx`) — mirrors `apps/showcase/app-providers.d.ts` and
// `@beeui/ui`'s own `overlay-transport.d.ts`/`date-picker.d.ts` convention exactly:
// `tsc` has no notion of Metro's `.native.tsx`/`.web.tsx` platform-suffix
// resolution, so a bare runtime `.tsx` file here would be the only candidate `tsc`
// ever sees, permanently shadowing whichever platform file Metro actually bundles.
import type * as React from 'react';

export declare function AppProviders(props: { children?: React.ReactNode }): React.ReactElement;
