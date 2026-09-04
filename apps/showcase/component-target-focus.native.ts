type ComponentTargetFocus = {
  focusTestId?: string;
  focusText?: string;
};

export function focusComponentTarget(_focus: ComponentTargetFocus) {
  return () => undefined;
}
