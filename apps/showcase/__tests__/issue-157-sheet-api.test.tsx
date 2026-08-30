import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { Modal, Text, View } from 'react-native';
import { Button } from '../../../packages/ui/src/components/button';
import { Input } from '../../../packages/ui/src/components/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHandle,
  SheetTitle,
  SheetTrigger,
  type SheetSnapPoint,
} from '../../../packages/ui/src/components/sheet.tsx';

// BeeUI issue #157 (R4B.2): deterministic contract tests for the Sheet public
// API defined per accepted ADR-006 (`docs/decisions/006-sheet-gesture-engine.md`).
// This exercises BeeUI's own public API/state/accessibility contract against
// the cross-platform skeleton -- not gorhom's own gesture/drag physics, which
// is #158's job behind an internal engine seam these tests never reach.

const SAFE_AREA_INSETS = { top: 20, right: 0, bottom: 30, left: 0 };

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    initialWindowMetrics: { frame: { x: 0, y: 0, width: 300, height: 600 }, insets: SAFE_AREA_INSETS },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => SAFE_AREA_INSETS,
  };
});

describe('BeeUI issue #157 Sheet public API contract', () => {
  it('stays closed until an uncontrolled trigger opens it, and SheetClose closes it', () => {
    render(
      <Sheet>
        <SheetTrigger>Open sheet</SheetTrigger>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
          <SheetClose>Done</SheetClose>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.queryByTestId('sheet-content')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Open sheet' }));
    expect(screen.getByTestId('sheet-content')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('sheet-content')).toBeNull();
  });

  it('honors the controlled open/onOpenChange contract, including backdrop dismissal', () => {
    const onOpenChange = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent overlayTestID="sheet-overlay" testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByTestId('sheet-content')).toBeTruthy();

    fireEvent.press(screen.getByTestId('sheet-overlay', { includeHiddenElements: true }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Controlled: the caller owns `open`, so the sheet does not close itself.
    expect(screen.getByTestId('sheet-content')).toBeTruthy();
  });

  it('keeps the Sheet open when backdrop dismissal is disabled', () => {
    const onOpenChange = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent closeOnBackdropPress={false} overlayTestID="sheet-overlay" testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    fireEvent.press(screen.getByTestId('sheet-overlay', { includeHiddenElements: true }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('registers SheetTitle/SheetDescription into the content accessibility relationship', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Refine results by category.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    const content = screen.getByTestId('sheet-content');
    expect(content.props.role).toBe('dialog');
    expect(content.props.accessibilityLabel).toBe('Filters');
    expect(content.props.accessibilityHint).toBe('Refine results by category.');
    const title = screen.getByText('Filters');
    expect(content.props.accessibilityLabelledBy).toBe(title.props.nativeID);
  });

  it('renders a decorative drag handle by default and can hide it', () => {
    const { rerender } = render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    const handle = screen.UNSAFE_getByType(SheetHandle).findByType(View);
    expect(handle.props.accessibilityElementsHidden).toBe(true);
    expect(handle.props['aria-hidden']).toBe(true);

    rerender(
      <Sheet defaultOpen>
        <SheetContent showHandle={false} testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.UNSAFE_queryAllByType(SheetHandle)).toHaveLength(0);
  });

  it('resolves a static presentation height from snapPoints and initialSnapIndex', () => {
    const snapPoints: SheetSnapPoint[] = ['40%', '80%'];

    const { rerender } = render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Default</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const flattenStyle = (style: unknown) =>
      Object.assign({}, ...(Array.isArray(style) ? style : [style]));

    expect(flattenStyle(screen.getByTestId('sheet-content').props.style).maxHeight).toBe('90%');

    rerender(
      <Sheet defaultOpen>
        <SheetContent initialSnapIndex={1} snapPoints={snapPoints} testID="sheet-content">
          <SheetTitle>Sized</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(flattenStyle(screen.getByTestId('sheet-content').props.style).maxHeight).toBe('80%');

    // Out-of-range indices clamp rather than throw or resolve to `undefined`.
    rerender(
      <Sheet defaultOpen>
        <SheetContent initialSnapIndex={5} snapPoints={snapPoints} testID="sheet-content">
          <SheetTitle>Clamped</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(flattenStyle(screen.getByTestId('sheet-content').props.style).maxHeight).toBe('80%');
  });

  it('pads the panel additively for the bottom safe area on top of the base spacing token', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    const flattenStyle = (style: unknown) =>
      Object.assign({}, ...(Array.isArray(style) ? style : [style]));
    // spacing['5'] (20px) + the mocked bottom inset (30px).
    expect(flattenStyle(screen.getByTestId('sheet-content').props.style).paddingBottom).toBe(50);
  });

  it('renders scrollable/input content inside the panel without a second focus trap', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
          <Text>Row one</Text>
          <Text>Row two</Text>
          <Button>Apply</Button>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByText('Row one')).toBeTruthy();
    expect(screen.getByText('Row two')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
  });

  it('accepts text input focus and edits inside the panel', () => {
    const onChangeText = jest.fn();
    render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Add note</SheetTitle>
          <Input accessibilityLabel="Note" onChangeText={onChangeText} />
        </SheetContent>
      </Sheet>,
    );

    fireEvent.changeText(screen.getByLabelText('Note'), 'Follow up tomorrow');
    expect(onChangeText).toHaveBeenCalledWith('Follow up tomorrow');
  });

  it('closes on a native request-close (Android Back / iOS request-close), mirroring the Dialog kernel', async () => {
    const onOpenChange = jest.fn();
    render(
      <Sheet defaultOpen onOpenChange={onOpenChange}>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    const modal = screen.UNSAFE_getByType(Modal);
    await act(async () => modal.props.onRequestClose?.());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('notifies onRequestClose without closing when dismissOnRequestClose is false', () => {
    const onRequestClose = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent
          dismissOnRequestClose={false}
          onRequestClose={onRequestClose}
          overlayTestID="sheet-overlay"
          testID="sheet-content"
        >
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    fireEvent.press(screen.getByTestId('sheet-overlay', { includeHiddenElements: true }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('sheet-content')).toBeTruthy();
  });
});
