import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Progress } from '@beemvp/beeui-ui';

// `accessibilityValue` does not reach react-native-web's DOM output, so a
// `role="progressbar"` needs `aria-valuemin`/`aria-valuenow`/`aria-valuemax` set
// explicitly as literal props to satisfy the required-attribute contract.
describe('BeeUI Progress aria-valuemin/now/max', () => {
  it('exposes the full value-range triad for an in-range value', () => {
    const screen = render(
      <Progress accessibilityLabel="In-stock variant coverage" max={8} testID="coverage" value={5} />,
    );

    const progress = screen.getByTestId('coverage');
    expect(progress.props['aria-valuemin']).toBe(0);
    expect(progress.props['aria-valuenow']).toBe(5);
    expect(progress.props['aria-valuemax']).toBe(8);
  });

  it('clamps aria-valuenow to the bounded max for an out-of-range value', () => {
    const screen = render(<Progress max={100} testID="upload" value={140} />);
    const progress = screen.getByTestId('upload');

    expect(progress.props['aria-valuemin']).toBe(0);
    expect(progress.props['aria-valuenow']).toBe(100);
    expect(progress.props['aria-valuemax']).toBe(100);
  });
});
