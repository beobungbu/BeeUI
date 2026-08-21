import * as React from 'react';
import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';
import { useControllableState } from '../hooks/use-controllable-state';
import { useFieldContext } from './field-context';

type EngineSwitchProps = RNSwitchProps & {
  ios_backgroundColorClassName?: string;
  thumbColorClassName?: string;
  trackColorOffClassName?: string;
  trackColorOnClassName?: string;
};

export type SwitchProps = Omit<
  RNSwitchProps,
  'accessibilityRole' | 'role' | 'ios_backgroundColor' | 'thumbColor' | 'trackColor'
> & {
  defaultValue?: boolean;
};

export const Switch = React.forwardRef<React.ComponentRef<typeof RNSwitch>, SwitchProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      defaultValue = false,
      disabled = false,
      onValueChange,
      value,
      ...props
    },
    ref,
  ) => {
    const field = useFieldContext();
    const resolvedDisabled = disabled === true || field?.disabled === true;
    const [resolvedValue, setValue] = useControllableState({
      defaultValue,
      disabled: resolvedDisabled,
      name: 'Switch',
      onChange: onValueChange,
      value,
    });
    const fieldLabel = field
      ? field.required
        ? `${field.label}, ${field.requiredAccessibilityLabel}`
        : field.label
      : undefined;
    const resolvedHint =
      accessibilityHint ?? (field?.invalid ? field.error : field?.description);
    const engineProps: EngineSwitchProps = {
      ...props,
      accessibilityHint: resolvedHint,
      accessibilityLabel: accessibilityLabel ?? fieldLabel,
      accessibilityLabelledBy: accessibilityLabelledBy ?? field?.labelNativeID,
      accessibilityRole: 'switch',
      accessibilityState: {
        ...accessibilityState,
        checked: resolvedValue,
        disabled: resolvedDisabled,
      },
      disabled: resolvedDisabled,
      ios_backgroundColorClassName: resolvedDisabled ? 'accent-disabled' : 'accent-muted',
      onValueChange: setValue,
      thumbColorClassName: resolvedDisabled ? 'accent-disabled-foreground' : 'accent-surface',
      trackColorOffClassName: resolvedDisabled ? 'accent-disabled' : 'accent-muted',
      trackColorOnClassName: resolvedDisabled ? 'accent-disabled' : 'accent-primary',
      value: resolvedValue,
    };

    return <RNSwitch ref={ref} {...engineProps} />;
  },
);

Switch.displayName = 'Switch';
