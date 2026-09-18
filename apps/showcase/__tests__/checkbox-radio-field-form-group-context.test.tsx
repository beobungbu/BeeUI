import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Checkbox, Field, FormGroup, Radio } from '@beemvp/beeui-ui';

// Field created no accessibilityLabelledBy relationship for a
// Switch/Checkbox/Radio child; the control's accessible name came only from its
// own accessibilityLabel, so `<Field label="X"><Checkbox/></Field>` left the
// Checkbox unlabelled whenever it had no own `label` prop.
describe('BeeUI Field label relationship reaches Checkbox and standalone Radio', () => {
  it('links an unlabelled Checkbox to its enclosing Field label', () => {
    const screen = render(
      <Field label="Receive marketing email">
        <Checkbox checked={false} onCheckedChange={() => {}} testID="marketing-checkbox" />
      </Field>,
    );

    const checkbox = screen.getByTestId('marketing-checkbox');
    expect(checkbox.props.accessibilityLabelledBy).toBeDefined();
    expect(checkbox.props.accessibilityLabelledBy).toEqual(expect.stringContaining('beeui-field-'));
  });

  it('keeps a Checkbox with its own label unaffected by the enclosing Field', () => {
    const screen = render(
      <Field label="Marketing preferences">
        <Checkbox checked={false} label="Receive marketing email" onCheckedChange={() => {}} testID="marketing-checkbox" />
      </Field>,
    );

    const checkbox = screen.getByTestId('marketing-checkbox');
    expect(checkbox.props.accessibilityLabel).toBe('Receive marketing email');
    expect(checkbox.props.accessibilityLabelledBy).toBeUndefined();
  });

  it('links a standalone Radio (not inside a RadioGroup) to its enclosing Field label', () => {
    const screen = render(
      <Field label="Auto-renew subscription">
        <Radio checked={false} onCheckedChange={() => {}} testID="auto-renew-radio" />
      </Field>,
    );

    const radio = screen.getByTestId('auto-renew-radio');
    expect(radio.props.accessibilityLabelledBy).toBeDefined();
    expect(radio.props.accessibilityLabelledBy).toEqual(expect.stringContaining('beeui-field-'));
  });
});

// FormGroup's legend/error/invalid/disabled context reached only
// RadioGroup; a Checkbox list inside FormGroup got the visible legend and error
// text but no accessibility relationship to either.
describe('BeeUI FormGroup error/disabled reaches a Checkbox list', () => {
  it('propagates FormGroup error text as accessibilityHint on each Checkbox', () => {
    const screen = render(
      <FormGroup error="Select at least one store." invalid legend="Assign to stores">
        <Checkbox checked={false} label="Store A" onCheckedChange={() => {}} testID="store-a" />
        <Checkbox checked={false} label="Store B" onCheckedChange={() => {}} testID="store-b" />
      </FormGroup>,
    );

    expect(screen.getByTestId('store-a').props.accessibilityHint).toBe('Select at least one store.');
    expect(screen.getByTestId('store-b').props.accessibilityHint).toBe('Select at least one store.');
  });

  it('propagates FormGroup disabled to every Checkbox in the list', () => {
    const screen = render(
      <FormGroup disabled legend="Assign to stores">
        <Checkbox checked={false} label="Store A" onCheckedChange={() => {}} testID="store-a" />
      </FormGroup>,
    );

    expect(screen.getByTestId('store-a').props.accessibilityState.disabled).toBe(true);
  });
});
