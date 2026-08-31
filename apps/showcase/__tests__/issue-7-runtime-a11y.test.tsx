import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  AlertBanner,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SearchInput,
  Separator,
} from '@beemvp/beeui-ui';

describe('BeeUI issue #7 runtime and accessibility follow-ups', () => {
  it('announces primitive AlertBanner content on iOS with polite queueing', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
      .mockImplementation(() => undefined);

    render(<AlertBanner description="Connection restored." title="Online" />);

    expect(announce).toHaveBeenCalledWith('Online, Connection restored.', { queue: true });

    announce.mockRestore();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  it('does not announce AlertBanner content when live semantics are disabled', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
      .mockImplementation(() => undefined);

    render(<AlertBanner live="none" title="Saved" />);

    expect(announce).not.toHaveBeenCalled();

    announce.mockRestore();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  it('uses self-stretch for vertical Separator sizing', () => {
    const screen = render(<Separator orientation="vertical" testID="separator" />);
    expect(screen.getByTestId('separator').props.className).toContain('self-stretch w-px');
  });

  it('links Dialog content to primitive title and description semantics', () => {
    const screen = render(
      <Dialog defaultOpen>
        <DialogContent testID="dialog-content">
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByTestId('dialog-content');
    const title = screen.getByText('Delete project');
    expect(content.props.accessibilityLabel).toBe('Delete project');
    expect(content.props.accessibilityHint).toBe('This action cannot be undone.');
    expect(content.props.accessibilityLabelledBy).toBe(title.props.nativeID);
  });

  it('emits one search reset when a non-empty query is cleared', () => {
    const onSearch = jest.fn();
    const screen = render(
      <SearchInput accessibilityLabel="Search" defaultValue="bee" onSearch={onSearch} />,
    );
    const input = screen.getByLabelText('Search');

    fireEvent.changeText(input, '');
    fireEvent.changeText(input, '');

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('');
  });
});
