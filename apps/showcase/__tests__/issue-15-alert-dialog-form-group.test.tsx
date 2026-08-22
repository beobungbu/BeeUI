import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  FormGroup,
  Radio,
  RadioGroup,
} from '@beeui/ui';

describe('BeeUI issue #15 alert dialog and form grouping', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps AlertDialog open when its backdrop is pressed', () => {
    const onOpenChange = jest.fn();
    const screen = render(
      <AlertDialog defaultOpen onOpenChange={onOpenChange}>
        <AlertDialogContent overlayTestID="alert-overlay" testID="alert-content">
          <AlertDialogTitle>Delete project</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );

    fireEvent.press(screen.getByTestId('alert-overlay', { includeHiddenElements: true }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('alert-content')).toBeTruthy();
  });

  it('preserves AlertDialog trigger and cancel handlers while closing predictably', () => {
    const onTriggerPress = jest.fn();
    const onCancelPress = jest.fn();
    const screen = render(
      <AlertDialog>
        <AlertDialogTrigger onPress={onTriggerPress}>Delete</AlertDialogTrigger>
        <AlertDialogContent testID="alert-content">
          <AlertDialogTitle>Delete project</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={onCancelPress}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(onTriggerPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('alert-content')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancelPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('alert-content')).toBeNull();
  });

  it('defaults AlertDialog action to destructive styling and closes after its handler', () => {
    const onActionPress = jest.fn();
    const screen = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent testID="alert-content">
          <AlertDialogTitle>Delete project</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogAction onPress={onActionPress}>Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const action = screen.getByRole('button', { name: 'Delete permanently' });
    expect(action.props.className).toContain('bg-destructive');

    fireEvent.press(action);
    expect(onActionPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('alert-content')).toBeNull();
  });

  it('inherits AlertDialog title and description accessibility metadata from the dialog kernel', () => {
    const screen = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent testID="alert-content">
          <AlertDialogTitle>Delete project</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const content = screen.getByTestId('alert-content');
    expect(content.props.role).toBe('dialog');
    expect(content.props.accessibilityViewIsModal).toBe(true);
    expect(content.props.accessibilityLabel).toBe('Delete project');
    expect(content.props.accessibilityHint).toBe('This action cannot be undone.');
    expect(content.props.accessibilityLabelledBy).toMatch(/^beeui-dialog-title-/);
  });

  it('can make native request-close paths notification-only for a critical AlertDialog', () => {
    const onRequestClose = jest.fn();
    const screen = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent
          cancelOnRequestClose={false}
          onRequestClose={onRequestClose}
          testID="alert-content"
        >
          <AlertDialogTitle>Irreversible operation</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const content = screen.getByTestId('alert-content');
    content.props.onAccessibilityEscape();

    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('alert-content')).toBeTruthy();
  });

  it('propagates FormGroup legend, description, required, and disabled metadata to RadioGroup', () => {
    const screen = render(
      <FormGroup description="Choose one plan." disabled legend="Plan" required testID="form-group">
        <RadioGroup testID="radio-group" value="starter">
          <Radio label="Starter" value="starter" />
          <Radio label="Pro" value="pro" />
        </RadioGroup>
      </FormGroup>,
    );

    const formGroup = screen.getByTestId('form-group');
    const radioGroup = screen.getByTestId('radio-group');
    const legend = screen.getByText('Plan');

    expect(formGroup.props.accessible).toBe(false);
    expect(radioGroup.props.accessibilityRole).toBe('radiogroup');
    expect(radioGroup.props.accessibilityLabel).toBe('Plan, required');
    expect(radioGroup.props.accessibilityLabelledBy).toBe(legend.props.nativeID);
    expect(radioGroup.props.accessibilityHint).toBe('Choose one plan.');
    expect(radioGroup.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('radio', { name: 'Starter' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('radio', { name: 'Pro' }).props.accessibilityState.disabled).toBe(true);
  });

  it('prefers FormGroup error text over description for invalid RadioGroup guidance', () => {
    const screen = render(
      <FormGroup
        description="Choose one plan."
        error="Select a plan before continuing."
        invalid
        legend="Plan"
      >
        <RadioGroup onValueChange={() => undefined} testID="radio-group" value="starter">
          <Radio label="Starter" value="starter" />
        </RadioGroup>
      </FormGroup>,
    );

    expect(screen.getByTestId('radio-group').props.accessibilityHint).toBe(
      'Select a plan before continuing.',
    );
    expect(screen.getByText('Select a plan before continuing.').props.accessibilityLiveRegion).toBe(
      'polite',
    );
  });

  it('keeps explicit RadioGroup accessibility props authoritative and child radios discoverable', () => {
    const screen = render(
      <FormGroup description="Inherited hint" legend="Plan">
        <RadioGroup
          accessibilityHint="Custom hint"
          accessibilityLabel="Billing plan"
          accessibilityLabelledBy="custom-plan-label"
          onValueChange={() => undefined}
          testID="radio-group"
          value="starter"
        >
          <Radio label="Starter" value="starter" />
          <Radio label="Pro" value="pro" />
        </RadioGroup>
      </FormGroup>,
    );

    const radioGroup = screen.getByTestId('radio-group');
    expect(radioGroup.props.accessibilityLabel).toBe('Billing plan');
    expect(radioGroup.props.accessibilityLabelledBy).toBe('custom-plan-label');
    expect(radioGroup.props.accessibilityHint).toBe('Custom hint');
    expect(screen.getByRole('radio', { name: 'Starter' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeTruthy();
  });
});
