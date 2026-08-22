import * as React from 'react';

export type FormGroupContextValue = {
  description?: string;
  disabled: boolean;
  error?: string;
  invalid: boolean;
  legendAccessibilityLabel: string;
  legendNativeID: string;
  required: boolean;
};

export const FormGroupContext = React.createContext<FormGroupContextValue | null>(null);

export function useFormGroupContext() {
  return React.useContext(FormGroupContext);
}
