import { cn } from '@beemvp/beeui-core';
import { fontSize } from '@beemvp/beeui-tokens';
import { Avatar, Text, textVariants } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// The tokens declare the type scale as `--text-<step>` theme variables, so Tailwind emits
// `text-caption` … `text-display` as font-size utilities. A consumer writing
// `<Text className="text-caption">` expects the caption size with the default foreground.
// The merge used to file every `text-<step>` under text colour: it dropped
// `text-foreground` (black text in dark, 1.09:1) and kept the variant's own size, which
// wins in the stylesheet (16px).

const bodySize = 'text-[length:var(--text-body)]';
const bodyLeading = 'leading-[var(--text-body--line-height)]';
const steps = Object.keys(fontSize);

describe('typography step classes merge as font sizes', () => {
  it('covers every step the tokens declare', () => {
    expect(steps).toEqual(expect.arrayContaining(['caption', 'label', 'body', 'heading', 'title', 'display']));
  });

  it.each(steps)('text-%s replaces the variant size and keeps the colour class', (step) => {
    const merged = cn(textVariants({ variant: 'body' }), `text-${step}`).split(' ');

    expect(merged).toContain('text-foreground');
    expect(merged).toContain(`text-${step}`);
    expect(merged).not.toContain(bodySize);
    expect(merged).not.toContain(bodyLeading);
  });

  it('still lets a colour class replace a colour class', () => {
    expect(cn('text-foreground text-caption', 'text-primary')).toBe('text-caption text-primary');
  });

  it('renders <Text className="text-caption"> with the caption size and the foreground colour', () => {
    const screen = render(<Text className="text-caption">Caption</Text>);
    const classes = String(screen.getByText('Caption').props.className).split(' ');

    expect(classes).toContain('text-caption');
    expect(classes).toContain('text-foreground');
    expect(classes).not.toContain(bodySize);
    expect(classes).not.toContain(bodyLeading);
  });
});

describe('Avatar fallback initials follow the avatar size', () => {
  it.each([
    ['sm', 'text-caption'],
    ['md', 'text-label'],
    ['lg', 'text-body'],
    ['xl', 'text-heading'],
  ] as const)('size="%s" renders %s with the muted foreground', (size, stepClass) => {
    const screen = render(<Avatar fallback="AT" size={size} />);
    const classes = String(screen.getByText('AT').props.className).split(' ');

    expect(classes).toContain(stepClass);
    expect(classes).toContain('text-muted-foreground');
    // The Text `label` variant's own size must be gone, or it wins in the stylesheet.
    expect(classes).not.toContain('text-[length:var(--text-label)]');
  });
});
