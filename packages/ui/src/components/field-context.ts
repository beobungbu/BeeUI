import * as React from 'react';

export type FieldContextValue = {
  description?: string;
  disabled: boolean;
  error?: string;
  invalid: boolean;
  label: string;
};

export const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldContext() {
  return React.useContext(FieldContext);
}
