import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Field, Input, PasswordInput } from '@beemvp/beeui-ui';

// A labelled Input publishes its current text through `accessibilityValue.text`
// so assistive tech announces both the label and the value together. That must
// never happen while the field is masked (`secureTextEntry`) — publishing the
// plaintext defeats the entire point of masking. A caller-supplied
// `accessibilityValue.text` still wins in every case, masked or not.
describe('Input/PasswordInput never auto-publish a masked value through accessibilityValue', () => {
  it('omits accessibilityValue.text for a labelled, masked PasswordInput', () => {
    const screen = render(
      <Field label="Password">
        <PasswordInput testID="password-field" value="secret123" />
      </Field>,
    );

    const field = screen.getByTestId('password-field');
    expect(field.props.accessibilityLabel).toBe('Password');
    expect(field.props.accessibilityValue?.text).toBeUndefined();
  });

  it('exposes the value once the show/hide toggle reveals the password', () => {
    const screen = render(
      <Field label="Password">
        <PasswordInput testID="password-field" value="secret123" />
      </Field>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByTestId('password-field').props.accessibilityValue).toEqual({
      text: 'secret123',
    });
  });

  it('lets a caller-supplied accessibilityValue.text win while masked', () => {
    const screen = render(
      <Field label="PIN">
        <PasswordInput
          accessibilityValue={{ text: 'PIN entered' }}
          testID="pin-field"
          value="1234"
        />
      </Field>,
    );

    expect(screen.getByTestId('pin-field').props.accessibilityValue).toEqual({
      text: 'PIN entered',
    });
  });

  it('leaves a plain, unmasked labelled Input publishing its value unchanged', () => {
    const screen = render(
      <Field label="Opening cash">
        <Input testID="cash-field" value="150000" />
      </Field>,
    );

    expect(screen.getByTestId('cash-field').props.accessibilityValue).toEqual({
      text: '150000',
    });
  });

  it('omits accessibilityValue.text for a directly masked Input outside PasswordInput', () => {
    const screen = render(
      <Input accessibilityLabel="Card PIN" secureTextEntry testID="pin-input" value="4321" />,
    );

    expect(screen.getByTestId('pin-input').props.accessibilityValue?.text).toBeUndefined();
  });
});
