import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Switch as RNSwitch } from 'react-native';
import { Field, Switch } from '@beemvp/beeui-ui';

// `<Field required>` previously always appended the untranslated English
// word "required" to a field-consuming control's accessible name with no way to
// localize or opt out. `required` state must reach assistive tech through
// `aria-required` (a real ARIA state, not injected copy), and any textual suffix
// must come only from an explicit, caller-supplied `requiredLabel`.
describe('BeeUI required reaches Switch via aria-required, not injected English copy', () => {
  it('exposes aria-required without any name suffix when requiredLabel is omitted', () => {
    const screen = render(
      <Field label="Tên sản phẩm" required>
        <Switch onValueChange={() => {}} value={false} />
      </Field>,
    );

    const control = screen.UNSAFE_getByType(RNSwitch);
    expect(control.props['aria-required']).toBe(true);
    expect(control.props.accessibilityLabel).toBe('Tên sản phẩm');
    expect(control.props.accessibilityLabel).not.toMatch(/required/i);
  });

  it('appends only the caller-supplied localized requiredLabel, never the English word', () => {
    const screen = render(
      <Field label="Tên sản phẩm" required requiredLabel="Bắt buộc">
        <Switch onValueChange={() => {}} value={false} />
      </Field>,
    );

    const control = screen.UNSAFE_getByType(RNSwitch);
    expect(control.props.accessibilityLabel).toBe('Tên sản phẩm, Bắt buộc');
    expect(control.props.accessibilityLabel).not.toMatch(/required/i);
  });

  it('omits aria-required entirely when the Field is not required', () => {
    const screen = render(
      <Field label="Tên sản phẩm">
        <Switch onValueChange={() => {}} value={false} />
      </Field>,
    );

    const control = screen.UNSAFE_getByType(RNSwitch);
    expect(control.props['aria-required']).toBeUndefined();
  });
});
