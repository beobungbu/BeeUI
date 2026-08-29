import * as React from 'react';
import { Platform, Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

type EngineSwitchProps = RNSwitchProps & {
  ios_backgroundColorClassName?: string;
  thumbColorClassName?: string;
  trackColorOffClassName?: string;
  trackColorOnClassName?: string;
};

export type SwitchProps = Omit<
  RNSwitchProps,
  'accessibilityRole' | 'role' | 'ios_backgroundColor' | 'thumbColor' | 'trackColor'
>;

export const Switch = React.forwardRef<React.ComponentRef<typeof RNSwitch>, SwitchProps>(
  ({ accessibilityState, disabled = false, onValueChange, value = false, ...props }, ref) => {
    useRequiredCallbackWarning('Switch', 'onValueChange', onValueChange, disabled);

    // react-native-web's own <Switch> spreads unrecognized props (including
    // `accessibilityRole`/`role`) onto the outer wrapper `<div>`, while it
    // *always* renders its own inner `<input type="checkbox" role="switch">`
    // for real interaction. Setting `accessibilityRole="switch"` here on Web
    // therefore produces two nested `role="switch"` elements (the outer div
    // gets a redundant role + tabIndex, and it lacks `aria-checked` since
    // that engine doesn't forward `accessibilityState` to the DOM), which
    // trips both `nested-interactive` and `aria-required-attr`. The engine's
    // own native `<input role="switch" checked>` already satisfies both
    // rules on its own (its native `checked` state is read as the implicit
    // `aria-checked` value), so on Web we omit the role/state override and
    // let that single native control carry the switch semantics. Native
    // iOS/Android keep `accessibilityRole`/`accessibilityState`, which real
    // native `Switch` widgets need for VoiceOver/TalkBack.
    const isWeb = Platform.OS === 'web';
    const engineProps: EngineSwitchProps = {
      ...props,
      ...(isWeb
        ? null
        : {
            accessibilityRole: 'switch' as const,
            accessibilityState: {
              ...accessibilityState,
              checked: value,
              disabled,
            },
          }),
      disabled,
      ios_backgroundColorClassName: disabled ? 'accent-disabled' : 'accent-muted',
      onValueChange,
      thumbColorClassName: disabled ? 'accent-disabled-foreground' : 'accent-surface',
      trackColorOffClassName: disabled ? 'accent-disabled' : 'accent-muted',
      trackColorOnClassName: disabled ? 'accent-disabled' : 'accent-primary',
      value,
    };

    return <RNSwitch ref={ref} {...engineProps} />;
  },
);

Switch.displayName = 'Switch';
