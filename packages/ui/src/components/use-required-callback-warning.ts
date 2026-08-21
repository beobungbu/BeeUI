import * as React from 'react';

export function useRequiredCallbackWarning(
  component: string,
  callbackName: string,
  callback: unknown,
  disabled = false,
) {
  React.useEffect(() => {
    if (
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      !disabled &&
      typeof callback !== 'function'
    ) {
      console.warn(
        `BeeUI ${component}: enabled controlled usage requires \`${callbackName}\`; interaction is read-only without it.`,
      );
    }
  }, [callback, callbackName, component, disabled]);
}
