import * as React from 'react';

type SetStateAction<T> = T | ((previous: T) => T);

export type UseControllableStateOptions<T> = {
  defaultValue: T;
  disabled?: boolean;
  name: string;
  onChange?: (value: T) => void;
  value?: T;
};

/**
 * Shared controlled/uncontrolled state kernel for interactive BeeUI primitives.
 *
 * The ref is advanced synchronously when a change is requested so two press events
 * delivered before React commits still observe the newest requested value.
 */
export function useControllableState<T>({
  defaultValue,
  disabled = false,
  name,
  onChange,
  value,
}: UseControllableStateOptions<T>) {
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const resolvedValue = controlled ? value : uncontrolledValue;
  const valueRef = React.useRef(resolvedValue);
  valueRef.current = resolvedValue;

  React.useEffect(() => {
    if (
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      controlled &&
      !disabled &&
      typeof onChange !== 'function'
    ) {
      console.warn(
        `BeeUI ${name}: a controlled value was provided without an onChange handler. The control is read-only until a handler is supplied or it is disabled.`,
      );
    }
  }, [controlled, disabled, name, onChange]);

  const setValue = React.useCallback(
    (nextAction: SetStateAction<T>) => {
      const previous = valueRef.current;
      const next =
        typeof nextAction === 'function'
          ? (nextAction as (current: T) => T)(previous)
          : nextAction;

      if (Object.is(previous, next)) return;

      // Advance synchronously so rapid repeated events do not both derive from stale state.
      valueRef.current = next;
      if (!controlled) setUncontrolledValue(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );

  return [resolvedValue, setValue, controlled] as const;
}
