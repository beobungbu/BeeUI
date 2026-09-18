import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Stepper, StepperItem } from '@beemvp/beeui-ui';

// Stepper was vertical-only with no way to lay it out as a
// horizontal row (e.g. a desktop onboarding wizard).
describe('BeeUI Stepper orientation prop', () => {
  it('stacks items vertically by default', () => {
    const screen = render(
      <Stepper currentStep={1} testID="stepper">
        <StepperItem step={1} title="Foundation" />
        <StepperItem step={2} title="Application" />
      </Stepper>,
    );

    expect(screen.getByTestId('stepper').props.className).not.toContain('flex-row');
  });

  it('lays items out as a horizontal row when orientation="horizontal"', () => {
    const screen = render(
      <Stepper currentStep={1} orientation="horizontal" testID="stepper">
        <StepperItem step={1} title="Foundation" />
        <StepperItem step={2} title="Application" />
      </Stepper>,
    );

    expect(screen.getByTestId('stepper').props.className).toContain('flex-row');
  });
});

// Stepper numbering is 1-based and a 0 clamps silently with no
// documented warning.
describe('BeeUI Stepper/StepperItem warn in dev on a 0 step', () => {
  it('warns when currentStep is 0 and clamps it up to 1', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const screen = render(
      <Stepper currentStep={0} testID="stepper">
        <StepperItem step={1} testID="step-1" title="Foundation" />
      </Stepper>,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1-based'));
    expect(screen.getByTestId('step-1').props['aria-current']).toBe('step');

    warn.mockRestore();
  });

  it('warns when a StepperItem step is 0 and clamps it up to 1', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <Stepper currentStep={1}>
        <StepperItem step={0} testID="step-0" title="Foundation" />
      </Stepper>,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1-based'));

    warn.mockRestore();
  });

  it('does not warn for a valid, positive step', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <Stepper currentStep={1}>
        <StepperItem step={1} title="Foundation" />
      </Stepper>,
    );

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
