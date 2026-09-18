import { Separator } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// `Separator orientation="vertical"` must draw without the caller supplying
// an explicit height: `self-stretch` lets it fill the cross-axis size its
// flex-row parent already establishes (e.g. from a taller sibling), instead
// of collapsing to a 0-height, invisible 1px-wide line.

describe('Separator orientation="vertical"', () => {
  it('stretches to fill its flex-row parent instead of collapsing to zero height', () => {
    const screen = render(<Separator orientation="vertical" testID="separator" />);

    const className = screen.getByTestId('separator').props.className as string;
    expect(className).toContain('self-stretch');
    expect(className).toContain('w-px');
  });

  it('renders a full-width fixed-height line for the default horizontal orientation', () => {
    const screen = render(<Separator testID="separator" />);

    const className = screen.getByTestId('separator').props.className as string;
    expect(className).toContain('h-px');
    expect(className).toContain('w-full');
  });
});
