import { render } from '@testing-library/react-native';
import { AppHeader, Button } from '@beemvp/beeui-ui';
import * as React from 'react';

// #284 — AppHeader large-text collapse: deterministic class-contract guard.
//
// The browser regression (apps/visual-regression/tests/
// app-header-large-text-showcase.spec.ts) proves the rendered outcome — the
// title column and content region stay usable at 1/1.3/1.5/2x on 390px and
// 360px viewports. This suite pins the exact layout contract that outcome
// depends on, so a revert of any one class fails fast without a browser:
//
//   - the header row wraps (`flex-wrap`) instead of crushing children when
//     leading/trailing outgrow the row;
//   - the title column keeps a real minimum width (`min-w-32`, not the old
//     collapsible `min-w-0`) while still flexing (`flex-1`);
//   - the trailing slot anchors to its logical end on its own wrap row
//     (`ms-auto` — margin-inline-start, not the physical `ml-auto`, so it
//     mirrors correctly under RTL; see #142's
//     `component-rtl-stress-showcase.spec.ts`) and never shrinks
//     (`shrink-0`).

function renderHeader() {
  return render(
    <AppHeader
      description="Interactive playground description"
      leading={<Button size="sm">Back</Button>}
      testID="header-under-test"
      title="Component Gallery"
      trailing={<Button size="sm">Theme</Button>}
    />,
  );
}

describe('AppHeader large-text layout contract (#284)', () => {
  it('wraps the header row instead of crushing children', () => {
    const screen = renderHeader();
    const root = screen.getByTestId('header-under-test');
    expect(root.props.className).toContain('flex-wrap');
    expect(root.props.className).toContain('flex-row');
  });

  it('gives the title column a non-collapsible minimum width', () => {
    const screen = renderHeader();
    const titleColumn = screen.getByText('Component Gallery').parent?.parent;
    const root = screen.getByTestId('header-under-test');
    // The title column is the direct child of the header root that contains
    // the title text; assert via the rendered tree's class contracts.
    const columns = root.children.filter(
      (child): child is Exclude<typeof child, string> => typeof child !== 'string',
    );
    const titleColumnNode = columns.find((child) =>
      String(child.props.className ?? '').includes('flex-1'),
    );
    expect(titleColumnNode).toBeTruthy();
    expect(titleColumnNode?.props.className).toContain('min-w-32');
    expect(titleColumnNode?.props.className).not.toContain('min-w-0');
    expect(titleColumn).toBeTruthy();
  });

  it('anchors the trailing slot to its logical end on wrap without letting it shrink', () => {
    const screen = renderHeader();
    const root = screen.getByTestId('header-under-test');
    const columns = root.children.filter(
      (child): child is Exclude<typeof child, string> => typeof child !== 'string',
    );
    const trailingNode = columns[columns.length - 1];
    expect(trailingNode?.props.className).toContain('ms-auto');
    expect(trailingNode?.props.className).toContain('shrink-0');
  });
});
