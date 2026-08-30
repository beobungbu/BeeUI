// Types-only module so `import './date-picker'` (used by the public barrel,
// `index.ts`) type-checks while Metro resolves the platform runtime
// (`date-picker.web.tsx` / `date-picker.native.tsx`). A base runtime `.ts`/`.tsx` file
// here would shadow the platform files (Metro tries the plain source extension before
// `.web.tsx`/`.native.tsx`), so the runtime lives only in the platform files — mirrors
// `overlay-transport.d.ts` exactly.
export * from './date-picker-shared';
import type { DatePickerProps } from './date-picker-shared';
import type * as React from 'react';
import type { Pressable } from 'react-native';

export declare const DatePicker: React.ForwardRefExoticComponent<
  DatePickerProps & React.RefAttributes<React.ComponentRef<typeof Pressable>>
>;
