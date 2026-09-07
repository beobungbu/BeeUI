export type ComponentTargetFocus = {
  focusTestId?: string;
  focusText?: string;
};

export declare function focusComponentTarget(focus: ComponentTargetFocus): () => void;
