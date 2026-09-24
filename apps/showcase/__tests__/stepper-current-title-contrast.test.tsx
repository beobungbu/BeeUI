import { Stepper, StepperItem } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// `text-primary` is the brand fill colour (amber #f59e0b on white is 2.15:1), below the
// 4.5:1 AA threshold for text. The current step's title is marked by weight instead; the
// filled primary step circle and `aria-current` carry the current state.

describe('Stepper current step title colour', () => {
  it('renders the current title in the foreground colour, emphasised by weight', () => {
    const screen = render(
      <Stepper currentStep={2}>
        <StepperItem step={1} title="Cart" />
        <StepperItem step={2} title="Payment" />
        <StepperItem step={3} title="Receipt" />
      </Stepper>,
    );
    const current = String(screen.getByText('Payment').props.className).split(' ');
    const upcoming = String(screen.getByText('Receipt').props.className).split(' ');

    expect(current).not.toContain('text-primary');
    expect(current).toContain('text-foreground');
    expect(current).toContain('font-bold');
    expect(upcoming).not.toContain('font-bold');
  });
});
