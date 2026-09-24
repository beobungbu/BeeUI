import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import {
  Pressable,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { useFieldContext } from './field-context';
import { Text } from './text';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

type SegmentMeasurement = {
  /** Narrowest width at which the label still breaks only between words (widest word + the item's own padding/border); 0 when unknown. */
  required: number;
  width: number;
  x: number;
};

type SegmentedControlContextValue = {
  disabled: boolean;
  /** Factor (<= 1) applied to every item's `required` width so the floors never overflow the control. */
  minWidthScale: number;
  onValueChange?: (value: string) => void;
  reportSegment: (id: string, measurement: SegmentMeasurement | null) => void;
  value: string;
};

// Scale that keeps the sum of the items' word-boundary floors inside the
// control. 1 while they fit; below 1 only when even one word per line cannot
// fit, where a mid-word break is the lesser evil than segments overflowing
// the control. The available width is derived from the items' own layout: the
// larger of the leading/trailing gaps between the items and the control's
// edges is its horizontal padding, even while the row overflows on one side
// (LTR or RTL).
function resolveMinWidthScale(controlWidth: number, segments: SegmentMeasurement[]) {
  const required = segments.reduce((sum, segment) => sum + segment.required, 0);
  if (controlWidth <= 0 || required <= 0) return 1;
  const start = Math.min(...segments.map((segment) => segment.x));
  const end = Math.max(...segments.map((segment) => segment.x + segment.width));
  const inset = Math.max(0, start, controlWidth - end);
  const itemsWidth = segments.reduce((sum, segment) => sum + segment.width, 0);
  const gaps = Math.max(0, end - start - itemsWidth);
  const available = controlWidth - 2 * inset - gaps;
  return required > available ? Math.max(0, available / required) : 1;
}

function sameScale(a: number, b: number) {
  return Math.abs(a - b) < 0.001;
}

const SegmentedControlContext = React.createContext<SegmentedControlContextValue | null>(null);

function useSegmentedControlContext() {
  const context = React.useContext(SegmentedControlContext);
  if (!context) throw new Error('SegmentedControlItem must be rendered inside SegmentedControl.');
  return context;
}

export type SegmentedControlProps = Omit<ViewProps, 'children' | 'role'> & {
  children?: React.ReactNode;
  className?: string;
  /** Disables every `SegmentedControlItem` inside, overriding each item's own `disabled`. Defaults to false. */
  disabled?: boolean;
  /** Called with the newly selected item's `value` when a non-selected item is pressed. Required for enabled usage (logs a dev warning otherwise). */
  onValueChange?: (value: string) => void;
  /** The `value` of the currently selected `SegmentedControlItem`. Always controlled by the caller — there is no uncontrolled mode. */
  value: string;
};

export const SegmentedControl = React.forwardRef<
  React.ComponentRef<typeof View>,
  SegmentedControlProps
>(({ accessibilityLabel, accessibilityLabelledBy, children, className, disabled = false, onLayout, onValueChange, value, ...props }, ref) => {
  useRequiredCallbackWarning('SegmentedControl', 'onValueChange', onValueChange, disabled);

  // The `radiogroup` previously had no accessible name at all (a screen
  // reader announced bare "radio group"). An explicit `accessibilityLabel`
  // always wins; absent that, falls back to the enclosing `Field`'s label the
  // same way `RadioGroup` already does.
  const field = useFieldContext();
  const resolvedAccessibilityLabelledBy = accessibilityLabelledBy ?? field?.labelNativeID;
  const resolvedAccessibilityLabel = accessibilityLabel ?? field?.label;

  // Segments are sized from their labels (`basis-auto`), not an equal split
  // of the row. Each item measures the narrowest width its label can take
  // while breaking only between words and reports it here; the control
  // scales those floors down only if they cannot all fit.
  const segmentsRef = React.useRef(new Map<string, SegmentMeasurement>());
  const controlWidthRef = React.useRef(0);
  const [minWidthScale, setMinWidthScale] = React.useState(1);
  const updateMinWidthScale = React.useCallback(() => {
    const next = resolveMinWidthScale(controlWidthRef.current, [...segmentsRef.current.values()]);
    setMinWidthScale((current) => (sameScale(current, next) ? current : next));
  }, []);
  const reportSegment = React.useCallback(
    (id: string, measurement: SegmentMeasurement | null) => {
      if (measurement) segmentsRef.current.set(id, measurement);
      else segmentsRef.current.delete(id);
      updateMinWidthScale();
    },
    [updateMinWidthScale],
  );
  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      controlWidthRef.current = event.nativeEvent.layout.width;
      updateMinWidthScale();
    },
    [onLayout, updateMinWidthScale],
  );

  const context = React.useMemo(
    () => ({ disabled, minWidthScale, onValueChange, reportSegment, value }),
    [disabled, minWidthScale, onValueChange, reportSegment, value],
  );

  return (
    <SegmentedControlContext.Provider value={context}>
      <View
        ref={ref}
        {...props}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityLabelledBy={resolvedAccessibilityLabelledBy}
        accessibilityRole="radiogroup"
        className={cn('flex-row rounded-md bg-muted p-1', className)}
        onLayout={handleLayout}
      >
        {children}
      </View>
    </SegmentedControlContext.Provider>
  );
});

SegmentedControl.displayName = 'SegmentedControl';

export type SegmentedControlItemProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'onPress' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  /** Called before the item's own selection logic runs, regardless of whether this item is already selected. */
  onPress?: PressableProps['onPress'];
  /** Identifies this item; compared against the parent `SegmentedControl`'s `value` to determine whether it is selected. */
  value: string;
};

export const SegmentedControlItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  SegmentedControlItemProps
>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      disabled = false,
      labelClassName,
      onLayout,
      onPress,
      style,
      value,
      ...props
    },
    ref,
  ) => {
    const control = useSegmentedControlContext();
    const selected = control.value === value;
    const isDisabled = disabled || control.disabled;
    const childArray = React.Children.toArray(children);
    const inferredLabel = childArray.every(
      (child) => typeof child === 'string' || typeof child === 'number',
    )
      ? childArray.map(String).join('')
      : undefined;
    const labelWords = inferredLabel?.split(/\s+/).filter(Boolean) ?? [];

    // Word-boundary floor: the widest single word (measured by an invisible
    // copy of the label laid out one word per line at its natural width) plus
    // this item's own horizontal padding and border, i.e. twice the label's
    // start offset inside the item. Both stay constant while the item's width
    // changes, so applying the floor cannot feed back into it. The extra 1px
    // absorbs sub-pixel rounding of the measured word.
    const segmentId = React.useId();
    const { reportSegment } = control;
    const [widestWord, setWidestWord] = React.useState(0);
    const [labelInset, setLabelInset] = React.useState<number | null>(null);
    const [itemLayout, setItemLayout] = React.useState<{ width: number; x: number } | null>(null);
    const required =
      widestWord > 0 && labelInset !== null ? Math.ceil(widestWord + 2 * labelInset) + 1 : 0;

    React.useEffect(() => {
      if (!itemLayout) return undefined;
      reportSegment(segmentId, { required, width: itemLayout.width, x: itemLayout.x });
      return undefined;
    }, [itemLayout, reportSegment, required, segmentId]);
    React.useEffect(() => () => reportSegment(segmentId, null), [reportSegment, segmentId]);

    // Web also starts from CSS `min-content` (`web:min-w-min`: the widest
    // word plus padding) so the very first frame, before any measurement
    // lands, already breaks only between words; an overlay that measures its
    // content once on open (Popover, DateTimePicker) then sees final geometry.
    // The measured inline `minWidth` below overrides it once known.
    const minWidth = required > 0 ? required * control.minWidthScale : undefined;
    const resolvedStyle: PressableProps['style'] =
      minWidth === undefined
        ? style
        : typeof style === 'function'
          ? (state) => [{ minWidth }, style(state)]
          : [{ minWidth }, style];

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole="radio"
        accessibilityState={{ ...accessibilityState, checked: selected, disabled: isDisabled }}
        // See Checkbox/Radio: `accessibilityState` is not forwarded to the DOM
        // by react-native-web, so `role="radio"` needs the web-native
        // `aria-checked` prop set explicitly to satisfy the required-attribute contract.
        aria-checked={selected}
        className={cn(
          'min-h-9 shrink grow basis-auto items-center web:min-w-min justify-center rounded-sm border px-3 py-2 active:opacity-80',
          selected
            ? 'border-border bg-surface-raised'
            : 'border-transparent bg-transparent web:hover:bg-surface-muted',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled}
        onLayout={(event) => {
          onLayout?.(event);
          const { width, x } = event.nativeEvent.layout;
          setItemLayout((current) =>
            current && current.width === width && current.x === x ? current : { width, x },
          );
        }}
        onPress={(event) => {
          onPress?.(event);
          if (!selected) control.onValueChange?.(value);
        }}
        style={resolvedStyle}
      >
        {labelWords.length > 0 ? (
          <View aria-hidden className="absolute inset-0 flex-row items-start overflow-hidden opacity-0" pointerEvents="none">
            <Text
              className={cn('shrink-0', labelClassName)}
              onLayout={(event) => setWidestWord(event.nativeEvent.layout.width)}
              variant="label"
            >
              {labelWords.join('\n')}
            </Text>
          </View>
        ) : null}
        {childArray.map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={`segmented-control-label-${index}`}
              className={cn(
                // A React Native flex item's default `flexShrink` is `0`
                // (unlike CSS Web's `1` — see Button's own `max-w-full` note), so
                // without an explicit width this label measures at its own
                // single-line intrinsic width and gets hard-clipped mid-glyph by
                // this item's `flex-1` bounds at large accessibility text sizes
                // instead of wrapping. `w-full` gives it the item's full
                // available width to wrap onto multiple lines within.
                'w-full text-center',
                selected ? 'text-foreground' : 'text-muted-foreground',
                labelClassName,
              )}
              onLayout={index === 0 ? (event) => setLabelInset(event.nativeEvent.layout.x) : undefined}
              variant="label"
            >
              {child}
            </Text>
          ) : (
            child
          ),
        )}
      </Pressable>
    );
  },
);

SegmentedControlItem.displayName = 'SegmentedControlItem';
