// Types-only module so `import './date-time-picker'` (used by the public barrel,
// `index.ts`) type-checks while Metro resolves the platform runtime
// (`date-time-picker.web.tsx` / `date-time-picker.native.tsx`). A base runtime
// `.ts`/`.tsx` file here would shadow the platform files (Metro tries the plain source
// extension before `.web.tsx`/`.native.tsx`), so the runtime lives only in the platform
// files — mirrors `date-picker.d.ts` exactly.
export * from './date-time-picker-shared';
import type { DateTimePickerProps } from './date-time-picker-shared';
import type * as React from 'react';
import type { Pressable } from 'react-native';

export declare const DateTimePicker: React.ForwardRefExoticComponent<
  DateTimePickerProps & React.RefAttributes<React.ComponentRef<typeof Pressable>>
>;
