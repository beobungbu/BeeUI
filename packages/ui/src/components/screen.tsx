import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';

const paddingClasses = {
  none: '',
  sm: 'px-3 py-3',
  md: 'px-5 py-5',
  lg: 'px-6 py-8',
} as const;

export type ScreenProps = ViewProps & {
  className?: string;
  /** Preset horizontal/vertical padding: `'none'` (0), `'sm'`, `'md'`, or `'lg'`. Defaults to `'none'`. */
  padding?: keyof typeof paddingClasses;
  /**
   * Wraps `children` in a keyboard-avoiding `ScrollView` (`behavior="padding"`
   * on iOS, matching `KeyboardAwareScreen`'s basic case) so a long form or
   * list needs no hand-rolled `ScrollView`. Pass `true` for the default
   * scroll body, or a `ScrollViewProps` object (excluding `children`) to
   * override any of it — e.g. `{ keyboardShouldPersistTaps: 'always' }`.
   * Defaults to `false`: children render directly, unchanged. For the fuller
   * Android focused-field scroll-into-view contract, use
   * `KeyboardAwareScreen` instead.
   */
  scroll?: boolean | Omit<ScrollViewProps, 'children'>;
};

export const Screen = React.forwardRef<React.ComponentRef<typeof View>, ScreenProps>(
  ({ children, className, padding = 'none', scroll = false, ...props }, ref) => {
    const scrollProps = scroll === false ? undefined : scroll === true ? {} : scroll;

    const body = scrollProps ? (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    ) : (
      children
    );

    return (
      <View
        ref={ref}
        className={cn('flex-1 bg-background', paddingClasses[padding], className)}
        {...props}
      >
        {body}
      </View>
    );
  },
);

Screen.displayName = 'Screen';
