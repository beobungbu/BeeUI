// Types-only module so `import ... from './tooltip'` type-checks under `tsc`
// (which has no concept of Metro's platform-extension resolution) while Metro
// itself resolves the real platform runtime (`tooltip.web.tsx`/
// `tooltip.native.tsx`). Mirrors `overlay-transport.d.ts`'s established pattern.
// A base `tooltip.tsx`/`.ts` here would be picked up by Metro's own generic
// fallback resolution and could shadow the platform file on platforms with no
// matching `.native.tsx` yet; a `.d.ts` produces no runtime module, so it never
// participates in bundling.
export * from './tooltip-shared';

import type * as React from 'react';
import type { Pressable, View } from 'react-native';
import type { TooltipContentProps, TooltipTriggerProps } from './tooltip-shared';

export declare const TooltipTrigger: React.ForwardRefExoticComponent<
  TooltipTriggerProps & React.RefAttributes<React.ComponentRef<typeof Pressable>>
>;

export declare const TooltipContent: React.ForwardRefExoticComponent<
  TooltipContentProps & React.RefAttributes<React.ComponentRef<typeof Pressable>>
>;
