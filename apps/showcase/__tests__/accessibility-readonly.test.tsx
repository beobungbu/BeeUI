import { render } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import {
  DescriptionItem,
  DescriptionList,
  Field,
  Input,
  Label,
  Text,
  VisuallyHidden,
} from '@beeui/ui';

describe('BeeUI accessibility and read-only contracts', () => {
  it('keeps visually hidden assistive content rendered while removing it from visual layout', () => {
    const screen = render(
      <VisuallyHidden testID="assistive-copy">
        <Text>Additional context</Text>
      </VisuallyHidden>,
    );

    const hidden = screen.getByTestId('assistive-copy');
    expect(screen.getByText('Additional context')).toBeTruthy();
    expect(hidden.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(hidden.props.style)).toMatchObject({
      position: 'absolute',
      left: -10000,
      width: 1,
      height: 1,
      overflow: 'hidden',
    });
  });

  it('gives required labels a readable accessible name without exposing the visual asterisk', () => {
    const screen = render(<Label required>Email</Label>);

    expect(screen.getByLabelText('Email, required')).toBeTruthy();
    expect(screen.getByText('*', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
  });

  it('links Field labels to Input and propagates readable required semantics', () => {
    const screen = render(
      <Field label="Email" labelNativeID="email-field-label" required>
        <Input testID="email-input" />
      </Field>,
    );

    const input = screen.getByTestId('email-input');
    expect(input.props.accessibilityLabelledBy).toBe('email-field-label');
    expect(input.props.accessibilityLabel).toBe('Email, required');
  });

  it('preserves explicit control accessibility overrides inside a required Field', () => {
    const screen = render(
      <Field label="Email" labelNativeID="email-field-label" required>
        <Input
          accessibilityLabel="Work email"
          accessibilityLabelledBy="custom-label"
          testID="email-input"
        />
      </Field>,
    );

    const input = screen.getByTestId('email-input');
    expect(input.props.accessibilityLabelledBy).toBe('custom-label');
    expect(input.props.accessibilityLabel).toBe('Work email');
  });

  it('composes description-list rows without taking ownership of formatting or data state', () => {
    const screen = render(
      <DescriptionList testID="profile-details">
        <DescriptionItem label="Plan" value="Pro" />
        <DescriptionItem description="Verified identity" label="Status" value="Active" />
      </DescriptionList>,
    );

    expect(screen.getByTestId('profile-details')).toBeTruthy();
    expect(screen.getByText('Plan')).toBeTruthy();
    expect(screen.getByText('Pro')).toBeTruthy();
    expect(screen.getByText('Verified identity')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });
});
