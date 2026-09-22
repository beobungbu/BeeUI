import { Button, ButtonLabel, Dialog, DialogTrigger } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// Button previously passed an explicit `<ButtonLabel>` child straight through
// unmodified — it never received the resolved `variant`/`size`, so it fell
// back to `ButtonLabel`'s own cva defaults (`variant: 'primary'`) regardless
// of what `variant` was actually passed to `Button`. Two consumer-visible
// symptoms:
//   - `labelClassName` silently had no effect when the child was an explicit
//     `ButtonLabel` (only the plain-string-child path merged it).
//   - `<DialogTrigger variant="outline">` (renders `Button` under the hood)
//     painted a `text-primary-foreground` label over an `outline` fill —
//     unreadable ~1.1:1 in dark, since `DialogTrigger`'s own trigger content
//     is typically written as an explicit `ButtonLabel` for extra styling.

describe('Button + explicit ButtonLabel child', () => {
  it('inherits the resolved variant text color when the child sets none of its own', () => {
    const screen = render(
      <Button testID="trigger" variant="outline">
        <ButtonLabel testID="label">Ghi chú</ButtonLabel>
      </Button>,
    );

    expect(screen.getByTestId('label').props.className).toContain('text-foreground');
    expect(screen.getByTestId('label').props.className).not.toContain('text-primary-foreground');
  });

  it('lets the child ButtonLabel keep its own explicit variant', () => {
    const screen = render(
      <Button testID="trigger" variant="outline">
        <ButtonLabel testID="label" variant="destructive">
          Delete
        </ButtonLabel>
      </Button>,
    );

    expect(screen.getByTestId('label').props.className).toContain('text-destructive-foreground');
  });

  it('merges Button labelClassName onto an explicit ButtonLabel child', () => {
    const screen = render(
      <Button labelClassName="uppercase" testID="trigger" variant="primary">
        <ButtonLabel testID="label">Confirm</ButtonLabel>
      </Button>,
    );

    expect(screen.getByTestId('label').props.className).toContain('uppercase');
  });

  it('still lets the child ButtonLabel className win over labelClassName', () => {
    const screen = render(
      <Button labelClassName="text-foreground" testID="trigger" variant="primary">
        <ButtonLabel className="text-info" testID="label">
          Info
        </ButtonLabel>
      </Button>,
    );

    // tailwind-merge dedupes the `text-*` utility, keeping the child's own.
    expect(screen.getByTestId('label').props.className).toContain('text-info');
  });

  it('forwards numberOfLines from an explicit ButtonLabel child unchanged', () => {
    const screen = render(
      <Button testID="trigger">
        <ButtonLabel numberOfLines={2} testID="label">
          Thêm thanh toán · 13.200 đ
        </ButtonLabel>
      </Button>,
    );

    expect(screen.getByTestId('label').props.numberOfLines).toBe(2);
  });

  it('reaches DialogTrigger, which renders Button internally', () => {
    const screen = render(
      <Dialog>
        <DialogTrigger testID="trigger" variant="outline">
          <ButtonLabel testID="label">Ghi chú</ButtonLabel>
        </DialogTrigger>
      </Dialog>,
    );

    expect(screen.getByTestId('label').props.className).toContain('text-foreground');
    expect(screen.getByTestId('label').props.className).not.toContain('text-primary-foreground');
  });
});

describe('Button height is a minimum, not a fixed height (label wraps at large text)', () => {
  it('uses min-h-* size classes so a wrapped two-line label is not clipped', () => {
    const screen = render(
      <Button size="md" testID="trigger">
        Thêm thanh toán · 13.200 đ
      </Button>,
    );

    const className = screen.getByTestId('trigger').props.className as string;
    expect(className).toContain('min-h-control-default');
    expect(className).not.toMatch(/(?<!min-)h-control-default\b/);
  });

  it('does not force numberOfLines on the auto-generated label for a plain string child', () => {
    const screen = render(<Button testID="trigger">Thêm thanh toán · 13.200 đ</Button>);

    expect(screen.getByText('Thêm thanh toán · 13.200 đ').props.numberOfLines).toBeUndefined();
  });
});
