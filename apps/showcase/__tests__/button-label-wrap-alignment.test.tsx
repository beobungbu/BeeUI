import { Button, ButtonLabel } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// A long label (a localized checkout CTA at large text) wraps inside the
// button; every wrapped line must be centred like a single-line label, not
// hug the start edge. `controls-sizing.spec.ts` measures the rendered lines.

const LABEL = 'Thêm thanh toán · 13.200 đ';

describe('Button label wrapping alignment', () => {
  it('centres a string label', () => {
    const screen = render(<Button>{LABEL}</Button>);
    expect(screen.getByText(LABEL).props.className).toContain('text-center');
  });

  it('centres an explicit ButtonLabel child', () => {
    const screen = render(
      <Button variant="outline">
        <ButtonLabel>{LABEL}</ButtonLabel>
      </Button>,
    );
    expect(screen.getByText(LABEL).props.className).toContain('text-center');
  });

  it('centres a standalone ButtonLabel', () => {
    const screen = render(<ButtonLabel>{LABEL}</ButtonLabel>);
    expect(screen.getByText(LABEL).props.className).toContain('text-center');
  });

  it('still lets labelClassName choose another alignment', () => {
    const screen = render(<Button labelClassName="text-left">{LABEL}</Button>);
    const className = screen.getByText(LABEL).props.className as string;
    expect(className).toContain('text-left');
    expect(className).not.toContain('text-center');
  });
});
