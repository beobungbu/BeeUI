import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Field, FormGroup, Input, Label, Radio, RadioGroup } from '@beemvp/beeui-ui';

// Field rendered its own Label with `aria-label="<label>, required"` AND
// passed the same computed name to the child control, so two nodes exposed the
// field's accessible name (Playwright `getByLabel` resolved to 2 elements on Web).
// The Label Field renders must never carry its own accessible name — only the
// child control (via its own `accessibilityLabel`/`accessibilityLabelledBy`)
// should, matching native `<label for>` semantics.
describe('BeeUI Field composes a Label with no accessible name of its own', () => {
  it('gives the rendered Label no accessibilityLabel even when required, while the Input keeps its own', () => {
    const screen = render(
      <Field label="Cửa hàng nhận" labelNativeID="store-field-label" required>
        <Input testID="store-input" />
      </Field>,
    );

    const label = screen.UNSAFE_getByProps({ nativeID: 'store-field-label' });
    expect(label.props.accessibilityLabel).toBeUndefined();

    const input = screen.getByTestId('store-input');
    expect(input.props.accessibilityLabel).toBe('Cửa hàng nhận');
    expect(input.props['aria-required']).toBe(true);
    expect(input.props.accessibilityLabelledBy).toBe('store-field-label');
  });

  it('gives the rendered Label no accessibilityLabel when not required either', () => {
    const screen = render(
      <Field label="Email" labelNativeID="email-field-label">
        <Input testID="email-input" />
      </Field>,
    );

    const label = screen.UNSAFE_getByProps({ nativeID: 'email-field-label' });
    expect(label.props.accessibilityLabel).toBeUndefined();
  });
});

describe('BeeUI standalone Label keeps its own required accessible name', () => {
  it('exposes its own accessible name when used directly, outside Field', () => {
    const screen = render(<Label required>Email</Label>);
    expect(screen.getByLabelText('Email, required')).toBeTruthy();
  });

  it('exposes no accessible name of its own when explicitly marked presentational', () => {
    const screen = render(
      <Label nativeID="x" presentational required>
        Email
      </Label>,
    );
    expect(screen.queryByLabelText('Email, required')).toBeNull();
  });
});

describe('BeeUI dedup extended to FormGroup + RadioGroup', () => {
  it('gives the rendered legend Label no accessibilityLabel, while RadioGroup still resolves its own via FormGroupContext', () => {
    const screen = render(
      <FormGroup legend="Plan" legendNativeID="plan-legend" required>
        <RadioGroup onValueChange={() => {}} testID="plan-group" value="starter">
          <Radio label="Starter" value="starter" />
        </RadioGroup>
      </FormGroup>,
    );

    const legend = screen.UNSAFE_getByProps({ nativeID: 'plan-legend' });
    expect(legend.props.accessibilityLabel).toBeUndefined();

    const radioGroup = screen.getByTestId('plan-group');
    expect(radioGroup.props.accessibilityLabel).toBe('Plan, required');
  });
});
