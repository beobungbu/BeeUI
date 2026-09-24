import { semanticColorVariable, type SemanticColorToken } from '@beemvp/beeui-tokens';
import * as React from 'react';
import { Platform, Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';
import { useFieldContext } from './field-context';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

type EngineSwitchProps = RNSwitchProps & {
  'aria-required'?: boolean;
  ios_backgroundColorClassName?: string;
  thumbColorClassName?: string;
  trackColorOffClassName?: string;
  trackColorOnClassName?: string;
};

// On Web the track/thumb colours reference the theme variables directly instead of going
// through Uniwind's `*ColorClassName` accent bridge. That bridge reads the stylesheet's
// rules during the first render; when the stylesheet reaches the page after that render
// (Metro's development server can deliver it late on a cold load) the colour comes back
// empty, logs "className 'accent-primary' ... no color was found", and the Switch keeps
// react-native-web's default colours until something else re-renders it. A `var()` colour
// is resolved by the browser whenever the stylesheet lands and follows theme and
// `BeeThemeScope` switches with no re-render. react-native-web passes a colour string
// through only when it starts with `var(`, so the dimmed disabled on-track carries its
// `color-mix` (the same value `accent-primary/40` compiles to) as the fallback of an
// unset custom property.
const themeColor = (token: SemanticColorToken) => `var(${semanticColorVariable(token)})`;
const webSwitchColors = {
  trackOn: themeColor('primary'),
  trackOnDisabled: `var(--beeui-switch-track-on-disabled, color-mix(in oklab, ${themeColor('primary')} 40%, transparent))`,
  trackOff: themeColor('muted'),
  trackOffDisabled: themeColor('disabled'),
  thumb: themeColor('surface'),
  thumbDisabled: themeColor('disabled-foreground'),
} as const;

export type SwitchProps = Omit<
  RNSwitchProps,
  'accessibilityRole' | 'role' | 'ios_backgroundColor' | 'thumbColor' | 'trackColor'
>;

export const Switch = React.forwardRef<React.ComponentRef<typeof RNSwitch>, SwitchProps>(
  (
    {
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      disabled = false,
      onValueChange,
      value = false,
      ...props
    },
    ref,
  ) => {
    useRequiredCallbackWarning('Switch', 'onValueChange', onValueChange, disabled);

    // Inside a `Field`, a Switch with no accessible name of its own (no
    // caller `accessibilityLabel`/`accessibilityLabelledBy`) falls back to the
    // Field's own label the same way `Input` already does, so
    // `<Field label="Notifications"><Switch/></Field>` gets a real accessible
    // name without the caller repeating the string. An explicit
    // `accessibilityLabel`/`accessibilityLabelledBy` from the caller always wins.
    const field = useFieldContext();
    const resolvedDisabled = disabled || field?.disabled === true;
    const resolvedAccessibilityLabelledBy = accessibilityLabelledBy ?? field?.labelNativeID;
    // The real DOM `aria-labelledby` attribute is a single space-separated ID
    // list string, while the RN-side `accessibilityLabelledBy` prop also
    // accepts an array of IDs — normalize to that string form for the literal
    // web prop below.
    const resolvedAriaLabelledBy = Array.isArray(resolvedAccessibilityLabelledBy)
      ? resolvedAccessibilityLabelledBy.join(' ')
      : resolvedAccessibilityLabelledBy;
    // No hardcoded English "required" copy — only a caller-supplied,
    // localized `requiredLabel` (via `Field`) is ever appended to the name;
    // otherwise `required` reaches assistive tech solely through `aria-required`
    // below.
    const fallbackFieldLabel =
      field && field.required && field.requiredLabel
        ? `${field.label}, ${field.requiredLabel}`
        : field?.label;
    // Matches `Input`'s established Field-fallback pattern (input.tsx): both a
    // resolved literal name and the `labelNativeID` relationship are set
    // together, never one to the exclusion of the other — `aria-labelledby`
    // (when present) takes full precedence over `aria-label` in accname
    // computation on Web, so this never produces a duplicate-name node; it just
    // keeps native platforms, which read the literal label, correct too.
    const resolvedAccessibilityLabel = accessibilityLabel ?? fallbackFieldLabel;

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
      accessibilityLabel: resolvedAccessibilityLabel,
      accessibilityLabelledBy: resolvedAccessibilityLabelledBy,
      // `required` reaches the DOM via `aria-required` (the RN-side
      // `accessibilityState` has no `required` key) rather than injected text.
      'aria-required': field?.required || undefined,
      ...(isWeb
        ? {
            // The compound `accessibilityLabelledBy` relationship hits the
            // same "never reaches the real interactive element" failure mode on
            // Web that `accessibilityState` does elsewhere in this file's
            // siblings (BeeECOM axe/Playwright evidence: the relationship lands
            // on a non-interactive wrapper, not the `<input role="switch">`).
            // Setting the web-native `aria-labelledby` prop directly, alongside
            // it, is the same established fix already applied to
            // `aria-checked`/`aria-busy`/`aria-controls` throughout this
            // package: the literal `aria-*` prop is what reaches the actual
            // host element.
            'aria-labelledby': resolvedAriaLabelledBy,
          }
        : {
            accessibilityRole: 'switch' as const,
            accessibilityState: {
              ...accessibilityState,
              checked: value,
              disabled: resolvedDisabled,
            },
          }),
      disabled: resolvedDisabled,
      onValueChange,
      value,
    };
    const colorProps: Partial<EngineSwitchProps> = isWeb
      ? {
          thumbColor: resolvedDisabled ? webSwitchColors.thumbDisabled : webSwitchColors.thumb,
          trackColor: {
            false: resolvedDisabled ? webSwitchColors.trackOffDisabled : webSwitchColors.trackOff,
            true: resolvedDisabled ? webSwitchColors.trackOnDisabled : webSwitchColors.trackOn,
          },
        }
      : {
          ios_backgroundColorClassName: resolvedDisabled ? 'accent-disabled' : 'accent-muted',
          thumbColorClassName: resolvedDisabled ? 'accent-disabled-foreground' : 'accent-surface',
          trackColorOffClassName: resolvedDisabled ? 'accent-disabled' : 'accent-muted',
          // A disabled Switch previously collapsed both the on and off track
          // colors to the flat `accent-disabled` swatch, making the current state
          // unreadable (e.g. in a locked permissions matrix). Keeping the on-state
          // at a dimmed primary tone instead — the issue's own suggested fix,
          // "keep the on/off contrast at reduced opacity" — preserves the on/off
          // distinction while disabled.
          trackColorOnClassName: resolvedDisabled ? 'accent-primary/40' : 'accent-primary',
        };

    return <RNSwitch ref={ref} {...engineProps} {...colorProps} />;
  },
);

Switch.displayName = 'Switch';
