import { cn } from '@beemvp/beeui-core';
import { semanticColorVariable } from '@beemvp/beeui-tokens';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';
import { useFieldContext } from './field-context';

const inputVariants = cva(
  'w-full rounded-md border bg-input text-foreground focus:border-focus-ring web:focus-visible:bee-focus-ring',
  {
    variants: {
      size: {
        // Font size comes from the semantic typography token on every
        // platform; the line height is Web-only. On native the TextInput
        // takes its line box from the font's own metrics, which scale with
        // the OS font scale together with the glyphs. An explicit native
        // `lineHeight` does not: iOS lays a single-line field's glyphs out at
        // the bottom of a fixed paragraph line box, so at accessibility sizes
        // descenders crossed the field's bottom border even though the row
        // itself grew. On Web the token line height is `rem`-based and tracks
        // the token font size, with the same computed value `leading-5`/`-6`
        // had (20px/24px), so textarea row measurement and 1x visuals stay
        // unchanged. `min-h-*` (not `h-*`) lets the row grow past its base
        // height; at the default font scale content stays below the floor,
        // so the rendered height is unchanged.
        sm: 'min-h-control-compact px-3 text-[length:var(--text-label)] web:leading-[var(--text-label--line-height)] ios:min-h-touch-target android:min-h-touch-target',
        md: 'min-h-control-default px-3 text-[length:var(--text-body)] web:leading-[var(--text-body--line-height)]',
        lg: 'min-h-control-large px-4 text-[length:var(--text-body)] web:leading-[var(--text-body--line-height)]',
      },
      invalid: {
        true: 'border-destructive focus:border-destructive',
        false: 'border-control-border',
      },
    },
    defaultVariants: {
      size: 'md',
      invalid: false,
    },
  },
);

type EngineTextInputProps = TextInputProps & {
  'aria-required'?: boolean;
  cursorColorClassName?: string;
  placeholderTextColorClassName?: string;
  selectionColorClassName?: string;
  selectionHandleColorClassName?: string;
  underlineColorAndroidClassName?: string;
};

const EngineTextInput = React.forwardRef<React.ComponentRef<typeof TextInput>, EngineTextInputProps>(
  (props, ref) => <TextInput ref={ref} {...props} />,
);

EngineTextInput.displayName = 'BeeUIEngineTextInput';

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

// Minimal DOM shapes (this package does not compile against the DOM lib).
type WebKeydownEvent = { currentTarget: object | null; stopPropagation: () => void };
type WebKeydownTarget = {
  addEventListener: (type: 'keydown', listener: (event: WebKeydownEvent) => void) => void;
  removeEventListener: (type: 'keydown', listener: (event: WebKeydownEvent) => void) => void;
};

// React marks every container it listens on (the app root and portal
// containers) with an own `_reactListening<random>` expando.
function isReactListeningContainer(target: object | null) {
  return target !== null && Object.keys(target).some((key) => key.startsWith('_reactListening'));
}

// Web only. react-native-web's TextInput calls `stopPropagation()` on every
// keydown before any caller handler runs (`handleKeyDown` in
// `react-native-web/dist/exports/TextInput/index.js`), whether or not the
// field uses the key. React runs that handler from its listener on the root
// container, so the native event never reaches `document` or `window` and
// every bubble-phase application shortcut (F-keys, Alt/Ctrl/Cmd chords,
// Escape) goes dead while the field has focus; a plain `<input>` does not do
// this.
//
// Installed as a target-phase listener on the field itself, this lets exactly
// that one call through: the first `stopPropagation()` made from React's root
// dispatch, which is react-native-web's own call because the field's
// `onKeyDown` is the innermost React handler. React still marks its synthetic
// event as stopped, so React ancestors (Toolbar/Tabs roving focus, Select
// listbox keys) keep ignoring keys typed into the field. Any later call —
// e.g. a caller's `onKeyPress` that deliberately stops the key — and any call
// from a native listener outside React's dispatch keep working. Nothing is
// re-dispatched, so capture-phase listeners still see each key once.
function letKeydownBubblePastTextInput(event: WebKeydownEvent) {
  const stopPropagation = event.stopPropagation;
  let skippedTextInputStop = false;
  event.stopPropagation = function stopPropagationAfterTextInput() {
    if (!skippedTextInputStop && isReactListeningContainer(event.currentTarget)) {
      skippedTextInputStop = true;
      return;
    }
    stopPropagation.call(event);
  };
}

// On Web the placeholder colour references the theme variable directly instead
// of going through Uniwind's `placeholderTextColorClassName` accent bridge,
// the only accent class Uniwind resolves for a Web TextInput. That bridge reads
// the stylesheet's rules during the first render; when the stylesheet reaches
// the page after that render (a cold load from Metro's development server) the
// colour comes back empty, logs "className 'accent-muted-foreground' ... no
// color was found", and the placeholder keeps the browser default until
// something re-renders the field. A `var()` colour is resolved by the browser
// whenever the stylesheet lands and follows theme and `BeeThemeScope` switches.
// The cursor/selection/underline accents have no Web equivalent in
// react-native-web's TextInput, so they are native-only.
const webPlaceholderTextColor = `var(${semanticColorVariable('muted-foreground')})`;
const nativeAccentColorProps = {
  cursorColorClassName: 'accent-primary',
  placeholderTextColorClassName: 'accent-muted-foreground',
  selectionColorClassName: 'accent-primary',
  selectionHandleColorClassName: 'accent-primary',
  underlineColorAndroidClassName: 'accent-transparent',
} as const;

export type InputProps = TextInputProps &
  Omit<VariantProps<typeof inputVariants>, 'invalid'> & {
    className?: string;
    /** Sets `editable={false}` (unless `editable` is already explicitly `false`) and applies disabled styling. ORed with the enclosing `Field`'s own `disabled`. Defaults to false. */
    disabled?: boolean;
    /** Applies destructive border styling and, when true, uses the enclosing `Field`'s `error` (instead of its `description`) as this input's accessibility hint. ORed with the enclosing `Field`'s own `invalid`. Defaults to false. */
    invalid?: boolean;
  };

export const Input = React.forwardRef<React.ComponentRef<typeof TextInput>, InputProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      accessibilityValue,
      className,
      defaultValue,
      disabled,
      editable,
      invalid,
      onChangeText,
      size,
      value,
      ...props
    },
    ref,
  ) => {
    const field = useFieldContext();
    const detachKeydownListenerRef = React.useRef<(() => void) | null>(null);
    const setInputRef = React.useCallback(
      (node: React.ComponentRef<typeof TextInput> | null) => {
        assignRef(ref, node);
        if (Platform.OS !== 'web') return;
        detachKeydownListenerRef.current?.();
        detachKeydownListenerRef.current = null;
        const element = node as unknown as Partial<WebKeydownTarget> | null;
        if (!element?.addEventListener || !element.removeEventListener) return;
        const target = element as WebKeydownTarget;
        target.addEventListener('keydown', letKeydownBubblePastTextInput);
        detachKeydownListenerRef.current = () =>
          target.removeEventListener('keydown', letKeydownBubblePastTextInput);
      },
      [ref],
    );
    const resolvedDisabled = disabled === true || field?.disabled === true;
    const resolvedInvalid = invalid === true || field?.invalid === true;
    const resolvedHint =
      accessibilityHint ?? (resolvedInvalid ? field?.error : field?.description);
    // No hardcoded English "required" copy — only a caller-supplied, localized
    // `Field.requiredLabel` (or the deprecated `Field.requiredAccessibilityLabel`,
    // when a caller sets it explicitly) is ever appended to the fallback name;
    // otherwise `required` reaches assistive tech solely through `aria-required`
    // below.
    const requiredSuffix = field?.required
      ? (field.requiredLabel ?? field.requiredAccessibilityLabel)
      : undefined;
    const resolvedAccessibilityLabel =
      accessibilityLabel ?? (requiredSuffix ? `${field?.label}, ${requiredSuffix}` : field?.label);

    // #614 — once an `accessibilityLabel` is present, iOS VoiceOver stops
    // announcing a plain TextInput's own typed value (the label replaces
    // rather than joins the native value announcement), leaving a labelled
    // field silently unreadable. Track the current text ourselves (mirroring
    // `value` when controlled, `onChangeText` when not) and publish it through
    // `accessibilityValue.text` so both the label and the value stay exposed.
    // Scoped to the exact labelled case the issue reports: an unlabelled
    // input already exposes its value correctly and is left untouched. A
    // caller's own `accessibilityValue.text` always wins.
    // Never auto-publish the raw text while `secureTextEntry` is set — that
    // would hand a masked password's plaintext straight to assistive tech, the
    // exact thing masking exists to prevent. A caller-supplied
    // `accessibilityValue.text` still wins in every case, masked or not.
    const isControlledValue = typeof value === 'string';
    const [trackedValue, setTrackedValue] = React.useState(
      isControlledValue ? value : typeof defaultValue === 'string' ? defaultValue : '',
    );
    const resolvedValue = isControlledValue ? value : trackedValue;
    const autoAccessibilityText = props.secureTextEntry ? undefined : resolvedValue;
    const resolvedAccessibilityValue = resolvedAccessibilityLabel
      ? accessibilityValue?.text !== undefined
        ? accessibilityValue
        : autoAccessibilityText !== undefined
          ? { ...accessibilityValue, text: autoAccessibilityText }
          : accessibilityValue
      : accessibilityValue;

    return (
      <EngineTextInput
        ref={setInputRef}
        {...props}
        accessibilityHint={resolvedHint}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityLabelledBy={accessibilityLabelledBy ?? field?.labelNativeID}
        accessibilityState={{ ...accessibilityState, disabled: resolvedDisabled }}
        accessibilityValue={resolvedAccessibilityValue}
        // `required` reaches the DOM via `aria-required` (RN's compound
        // `accessibilityState` has no `required` key) rather than injected text.
        aria-required={field?.required || undefined}
        className={cn(
          inputVariants({ invalid: resolvedInvalid, size }),
          resolvedDisabled &&
            'border-control-border bg-disabled text-disabled-foreground opacity-70',
          className,
        )}
        {...(Platform.OS === 'web'
          ? {
              // react-native-web drops `accessibilityHint`, so the Field's
              // helper text reaches Web assistive tech through `aria-describedby`.
              'aria-describedby': field?.descriptionNativeID,
              placeholderTextColor: props.placeholderTextColor ?? webPlaceholderTextColor,
            }
          : nativeAccentColorProps)}
        defaultValue={defaultValue}
        editable={!resolvedDisabled && editable !== false}
        onChangeText={(text) => {
          if (!isControlledValue) setTrackedValue(text);
          onChangeText?.(text);
        }}
        value={value}
      />
    );
  },
);

Input.displayName = 'Input';

export { inputVariants };
