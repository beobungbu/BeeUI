import * as React from 'react';
import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';

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
  ({ accessibilityState, disabled = false, value = false, ...props }, ref) => {
    const engineProps: EngineSwitchProps = {
      ...props,
      accessibilityRole: 'switch',
      accessibilityState: {
        ...accessibilityState,
        checked: value,
        disabled,
      },
      disabled,
      ios_backgroundColorClassName: disabled ? 'accent-disabled' : 'accent-muted',
      thumbColorClassName: disabled ? 'accent-disabled-foreground' : 'accent-surface',
      trackColorOffClassName: disabled ? 'accent-disabled' : 'accent-muted',
      trackColorOnClassName: disabled ? 'accent-disabled' : 'accent-primary',
      value,
    };

    return <RNSwitch ref={ref} {...engineProps} />;
  },
);

Switch.displayName = 'Switch';
