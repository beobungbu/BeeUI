import { Badge } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// `Badge variant="outline"` (`border-border-strong bg-surface`) was visually
// indistinguishable from a disabled text input using the same border token in
// a table row. A stronger, foreground-derived border reads as a deliberate
// outline regardless of theme, since it is always derived from that theme's
// own foreground token rather than a separate border token that can happen
// to sit close to it.

describe('Badge variant="outline" contrast', () => {
  it('uses a foreground-derived border, not border-border-strong', () => {
    const screen = render(<Badge testID="badge" variant="outline" />);

    const className = screen.getByTestId('badge').props.className as string;
    expect(className).toContain('border-foreground/40');
    expect(className).not.toContain('border-border-strong');
  });

  it('keeps the foreground label text token', () => {
    const screen = render(<Badge variant="outline">Draft</Badge>);

    expect(screen.getByText('Draft').props.className).toContain('text-foreground');
  });
});
