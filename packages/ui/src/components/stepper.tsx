import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

type StepperContextValue = {
  currentStep: number;
  disabled: boolean;
  onStepChange?: (step: number) => void;
  totalSteps: number;
};

const StepperContext = React.createContext<StepperContextValue | null>(null);

function useStepperContext() {
  const context = React.useContext(StepperContext);
  if (!context) throw new Error('StepperItem must be rendered inside Stepper.');
  return context;
}

export type StepperProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  currentStep: number;
  disabled?: boolean;
  onStepChange?: (step: number) => void;
};

export const Stepper = React.forwardRef<React.ComponentRef<typeof View>, StepperProps>(
  ({ children, className, currentStep, disabled = false, onStepChange, ...props }, ref) => {
    const renderedChildren = React.Children.toArray(children);
    const totalSteps = renderedChildren.length;
    const normalizedCurrentStep = Math.min(
      Math.max(1, Math.floor(currentStep)),
      Math.max(1, totalSteps),
    );
    const context = React.useMemo(
      () => ({ currentStep: normalizedCurrentStep, disabled, onStepChange, totalSteps }),
      [disabled, normalizedCurrentStep, onStepChange, totalSteps],
    );

    return (
      <StepperContext.Provider value={context}>
        <View ref={ref} className={cn('gap-3', className)} {...props}>
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
    const normalizedStep = Math.max(1, Math.floor(step));
    const current = normalizedStep === stepper.currentStep;
    const complete = normalizedStep < stepper.currentStep;
    const isDisabled = disabled === true || stepper.disabled;
    const interactive = typeof stepper.onStepChange === 'function' || typeof onPress === 'function';
    const inferredLabel =
      typeof title === 'string' || typeof title === 'number' ? String(title) : undefined;

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
        className={cn(
          'flex-row items-start gap-3 rounded-lg px-2 py-2',
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
        <Box className="min-w-0 flex-1 gap-0.5 pt-1">
          {typeof title === 'string' || typeof title === 'number' ? (
            <Text tone={current ? 'primary' : 'default'} variant="label">
              {title}
            </Text>
          ) : (
            title
          )}
          {description ? (
            typeof description === 'string' || typeof description === 'number' ? (
              <Text tone="muted" variant="caption">
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
