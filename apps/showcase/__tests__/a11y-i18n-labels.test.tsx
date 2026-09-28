import {
  Pagination,
  PaginationItem,
  useToast,
} from '@beemvp/beeui-ui';
import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
import { ToastRuntimeProvider } from '../../../packages/ui/src/components/toast';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>{children}</View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

function LocalizedToastHarness() {
  const toast = useToast();
  const shownRef = React.useRef(false);

  React.useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    toast.show({
      dismissAccessibilityLabel: 'Đóng thông báo Lưu thành công',
      duration: 'persistent',
      title: 'Lưu thành công',
    });
  }, [toast]);

  return null;
}

describe('BeeUI localized accessibility labels', () => {
  it('uses caller-supplied localized Toast dismiss copy', async () => {
    const screen = render(
      <ToastRuntimeProvider placement="top">
        <LocalizedToastHarness />
      </ToastRuntimeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Đóng thông báo Lưu thành công')).toBeTruthy();
    });
  });

  it('keeps the existing English Toast dismiss label when no override is supplied', async () => {
    function DefaultToastHarness() {
      const toast = useToast();
      const shownRef = React.useRef(false);
      React.useEffect(() => {
        if (shownRef.current) return;
        shownRef.current = true;
        toast.show({ duration: 'persistent', title: 'Saved' });
      }, [toast]);
      return null;
    }

    const screen = render(
      <ToastRuntimeProvider placement="top">
        <DefaultToastHarness />
      </ToastRuntimeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Dismiss Saved')).toBeTruthy();
    });
  });

  it('localizes Pagination container and inherited item labels from one root contract', () => {
    const screen = render(
      <Pagination
        labels={{
          container: 'Phân trang',
          previous: 'Trang trước',
          next: 'Trang sau',
          invalidPage: 'Trang',
          page: (page) => `Trang ${page}`,
        }}
        onPageChange={() => {}}
        page={2}
        pageCount={3}
        testID="pagination"
      >
        <PaginationItem testID="previous" type="previous" />
        <PaginationItem page={2} testID="page-2" />
        <PaginationItem testID="next" type="next" />
      </Pagination>,
    );

    expect(screen.getByTestId('pagination').props.accessibilityLabel).toBe('Phân trang');
    expect(screen.getByTestId('previous').props.accessibilityLabel).toBe('Trang trước');
    expect(screen.getByTestId('page-2').props.accessibilityLabel).toBe('Trang 2');
    expect(screen.getByTestId('next').props.accessibilityLabel).toBe('Trang sau');
  });

  it('preserves explicit per-control labels over Pagination defaults', () => {
    const screen = render(
      <Pagination accessibilityLabel="Pager custom" page={1} pageCount={2}>
        <PaginationItem accessibilityLabel="Forward custom" type="next" />
      </Pagination>,
    );

    expect(screen.getByLabelText('Pager custom')).toBeTruthy();
    expect(screen.getByLabelText('Forward custom')).toBeTruthy();
  });
});
