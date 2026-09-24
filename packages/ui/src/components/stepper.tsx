import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

type StepperOrientation = 'horizontal' | 'vertical';

type StepperContextValue = {
  currentStep: number;
  disabled: boolean;
  duplicateSteps: ReadonlySet<number>;
  onStepChange?: (step: number) => void;
  orientation: StepperOrientation;
  totalSteps: number;
};

const StepperContext = React.createContext<StepperContextValue | null>(null);

function useStepperContext() {
  const context = React.useContext(StepperContext);
  if (!context) throw new Error('StepperItem must be rendered inside Stepper.');
  return context;
}

function normalizeStep(step: number) {
  return Number.isFinite(step) ? Math.max(1, Math.floor(step)) : undefined;
}

export type StepperProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * The active step number, 1-based (never 0-based) and clamped to
   * `[1, number of StepperItem children]`. Non-finite values, and values below 1
   * (including `0`), fall back to/clamp up to `1` with a dev-mode warning.
   */
  currentStep: number;
  /** Disables every `StepperItem` inside, overriding each item's own `disabled`. Defaults to false. */
  disabled?: boolean;
  /** Called with a step's normalized step number when a non-disabled `StepperItem` is pressed. Also required (alongside a per-item `onPress`) for any item to render as interactive. */
  onStepChange?: (step: number) => void;
  /** Lays items out as a horizontal row (e.g. a desktop onboarding wizard) instead of the default vertical stack. Defaults to `'vertical'`. */
  orientation?: StepperOrientation;
};

export const Stepper = React.forwardRef<React.ComponentRef<typeof View>, StepperProps>(
  (
    { children, className, currentStep, disabled = false, onStepChange, orientation = 'vertical', ...props },
    ref,
  ) => {
    const renderedChildren = React.Children.toArray(children);
    const totalSteps = renderedChildren.length;
    const finiteCurrentStep = Number.isFinite(currentStep) ? Math.floor(currentStep) : 1;
    const normalizedCurrentStep = Math.min(
      Math.max(1, finiteCurrentStep),
      Math.max(1, totalSteps),
    );

    React.useEffect(() => {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return;
      if (finiteCurrentStep < 1) {
        console.warn(
          `BeeUI Stepper: \`currentStep\` is 1-based; received ${finiteCurrentStep}, which clamps up to 1.`,
        );
      }
    }, [finiteCurrentStep]);
    const duplicateSteps = React.useMemo(() => {
      const counts = new Map<number, number>();

      for (const child of renderedChildren) {
        if (!React.isValidElement<{ step?: unknown }>(child) || typeof child.props.step !== 'number') {
          continue;
        }
        const normalizedStep = normalizeStep(child.props.step);
        if (normalizedStep === undefined) continue;
        counts.set(normalizedStep, (counts.get(normalizedStep) ?? 0) + 1);
      }

      return new Set(
        [...counts.entries()]
          .filter(([, count]) => count > 1)
          .map(([step]) => step),
      );
    }, [renderedChildren]);
    const duplicateStepKey = [...duplicateSteps].sort((a, b) => a - b).join(',');

    React.useEffect(() => {
      if (typeof __DEV__ !== 'undefined' && __DEV__ && duplicateStepKey) {
        console.warn(
          `BeeUI Stepper: duplicate normalized step values detected (${duplicateStepKey}). Duplicate items are disabled until each step value is unique.`,
        );
      }
    }, [duplicateStepKey]);

    const context = React.useMemo(
      () => ({
        currentStep: normalizedCurrentStep,
        disabled,
        duplicateSteps,
        onStepChange,
        orientation,
        totalSteps,
      }),
      [disabled, duplicateSteps, normalizedCurrentStep, onStepChange, orientation, totalSteps],
    );

    return (
      <StepperContext.Provider value={context}>
        <View
          ref={ref}
          className={cn(orientation === 'horizontal' ? 'flex-row items-start gap-3' : 'gap-3', className)}
          {...props}
        >
          {renderedChildren}
        </View>
      </StepperContext.Provider>
    );
  },
);

Stepper.displayName = 'Stepper';

export type StepperItemProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'role'
> & {
  className?: string;
  description?: React.ReactNode;
  /**
   * This item's position, 1-based (never 0-based). Non-finite values, and values
   * below 1 (including `0`), are floored and clamp up to `1` with a dev-mode
   * warning. Compared against the parent `Stepper`'s `currentStep` to determine
   * current/complete state. A value duplicated by another item is disabled with a
   * separate dev-mode warning.
   */
  step: number;
  title: React.ReactNode;
};

export const StepperItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  StepperItemProps
>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      accessibilityValue,
      className,
      description,
      disabled = false,
      onPress,
      step,
      title,
      ...props
    },
    ref,
  ) => {
    const stepper = useStepperContext();
    const finiteStep = Number.isFinite(step) ? Math.floor(step) : undefined;
    const normalizedStep = normalizeStep(step) ?? 1;
    const duplicate = stepper.duplicateSteps.has(normalizedStep);
    const current = !duplicate && normalizedStep === stepper.currentStep;
    const complete = !duplicate && normalizedStep < stepper.currentStep;
    const isDisabled = disabled === true || stepper.disabled || duplicate;
    const interactive = typeof stepper.onStepChange === 'function' || typeof onPress === 'function';
    const inferredLabel =
      typeof title === 'string' || typeof title === 'number' ? String(title) : undefined;
    const horizontal = stepper.orientation === 'horizontal';

    React.useEffect(() => {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return;
      if (finiteStep !== undefined && finiteStep < 1) {
        console.warn(
          `BeeUI StepperItem: \`step\` is 1-based; received ${finiteStep}, which clamps up to 1.`,
        );
      }
    }, [finiteStep]);

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole={interactive ? 'button' : undefined}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled, selected: current }}
        accessibilityValue={{
          ...accessibilityValue,
          text: accessibilityValue?.text ?? `Step ${normalizedStep} of ${stepper.totalSteps}`,
        }}
        accessible
        // `accessibilityState` alone does not reach the DOM on react-native-web (see
        // Checkbox), so the current step needs the web-native `aria-current="step"`
        // prop set explicitly, matching Pagination's `aria-current="page"`.
        aria-current={current ? 'step' : undefined}
        className={cn(
          horizontal ? 'flex-1 flex-col items-center gap-2 rounded-lg px-2 py-2' : 'flex-row items-start gap-3 rounded-lg px-2 py-2',
          interactive && 'active:bg-muted web:hover:bg-surface-muted',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled || !interactive}
        onPress={(event) => {
          onPress?.(event);
          if (!isDisabled) stepper.onStepChange?.(normalizedStep);
        }}
      >
        <Box
          className={cn(
            'h-8 w-8 shrink-0 items-center justify-center rounded-full border',
            current || complete ? 'border-primary bg-primary' : 'border-border-strong bg-surface',
          )}
        >
          <Text
            className={current || complete ? 'text-primary-foreground' : 'text-muted-foreground'}
            variant="label"
          >
            {complete ? '✓' : normalizedStep}
          </Text>
        </Box>
        <Box className={cn('min-w-0 gap-0.5', horizontal ? 'items-center' : 'flex-1 pt-1')}>
          {typeof title === 'string' || typeof title === 'number' ? (
            // The current title is marked by weight, not `tone="primary"`: primary is a fill
            // colour (amber #f59e0b on white is 2.15:1), below AA for text. The filled
            // primary step circle and `aria-current` already carry the current state.
            <Text
              className={cn(horizontal && 'text-center', current && 'font-bold')}
              variant="label"
            >
              {title}
            </Text>
          ) : (
            title
          )}
          {description ? (
            typeof description === 'string' || typeof description === 'number' ? (
              <Text className={horizontal ? 'text-center' : undefined} tone="muted" variant="caption">
                {description}
              </Text>
            ) : (
              description
            )
          ) : null}
        </Box>
      </Pressable>
    );
  },
);

StepperItem.displayName = 'StepperItem';
