import * as React from 'react';

export type FieldContextValue = {
  description?: string;
  disabled: boolean;
  error?: string;
  invalid: boolean;
  label: string;
  labelNativeID: string;
  required: boolean;
  /** No default — omit to expose `required` only through `aria-required`/`accessibilityRequired` on field-consuming controls, without injecting English copy. @deprecated Use `requiredLabel` instead — a no-default, caller-localized field for new integrations. Kept for existing consumers (e.g. `Input`) built on it. */
  requiredAccessibilityLabel?: string;
  /** Localized copy appended to a field-consuming control's accessible name when `required` is true (e.g. `"Bắt buộc"`). No default — omit to expose only `aria-required`/`accessibilityRequired` on the control instead of injecting English copy. */
  requiredLabel?: string;
};

export const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldContext() {
  return React.useContext(FieldContext);
}
