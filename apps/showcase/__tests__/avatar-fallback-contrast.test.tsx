import { Avatar } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// Avatar's fallback initials must never render with react-native-web's
// default black text color: this locks in the `text-muted-foreground` token
// on `avatarFallbackVariants`'s base classes so a regression (e.g. a future
// refactor accidentally dropping the color class while only keeping the size
// step) fails a fast, deterministic test instead of only showing up in a
// dark-theme visual sweep.

describe('Avatar fallback text color', () => {
  it('uses a real foreground token, never an unset/default color', () => {
    const screen = render(<Avatar fallback="AT" />);

    expect(screen.getByText('AT').props.className).toContain('text-muted-foreground');
  });

  it('lets fallbackClassName override the token for a specific call site', () => {
    const screen = render(<Avatar fallback="AT" fallbackClassName="text-foreground" />);

    expect(screen.getByText('AT').props.className).toContain('text-foreground');
  });
});
