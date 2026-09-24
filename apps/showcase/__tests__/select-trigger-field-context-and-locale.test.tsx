import { render as renderBare } from '@testing-library/react-native';
import * as React from 'react';
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@beemvp/beeui-ui';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

function render(element: React.ReactElement) {
  return renderBare(<OverlayRuntimeProvider>{element}</OverlayRuntimeProvider>);
}

function FieldSelect(props: Omit<React.ComponentProps<typeof Field>, 'children'>) {
  return (
    <Field {...props}>
      <Select>
        <SelectTrigger testID="trigger">
          <SelectValue placeholder="Chọn cửa hàng" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

describe('SelectTrigger inside a Field is the field control, like Input', () => {
  it('is named by and linked to the field label, not its placeholder', () => {
    const screen = render(<FieldSelect label="Cửa hàng nhận" labelNativeID="store-label" required />);
    const trigger = screen.getByTestId('trigger');
    expect(trigger.props.accessibilityLabel).toBe('Cửa hàng nhận');
    expect(trigger.props.accessibilityLabelledBy).toBe('store-label');
    expect(trigger.props['aria-required']).toBe(true);
    expect(trigger.props['aria-invalid']).toBeUndefined();
  });

  it('appends the caller-localized required label to the name, as Input does', () => {
    const screen = render(
      <FieldSelect label="Cửa hàng nhận" labelNativeID="store-label" required requiredLabel="Bắt buộc" />,
    );
    expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Cửa hàng nhận, Bắt buộc');
  });

  it('takes the description as its hint, and the error instead when the field is invalid', () => {
    const described = render(<FieldSelect description="Giao trong ngày" label="Cửa hàng" />);
    expect(described.getByTestId('trigger').props.accessibilityHint).toBe('Giao trong ngày');
    described.unmount();

    const invalid = render(
      <FieldSelect description="Giao trong ngày" error="Chọn một cửa hàng" invalid label="Cửa hàng" />,
    );
    const trigger = invalid.getByTestId('trigger');
    expect(trigger.props.accessibilityHint).toBe('Chọn một cửa hàng');
    expect(trigger.props['aria-invalid']).toBe(true);
  });

  it('ORs in the field disabled state', () => {
    const screen = render(<FieldSelect disabled label="Cửa hàng" />);
    expect(screen.getByTestId('trigger').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('lets a caller-supplied accessibilityLabel and accessibilityLabelledBy win', () => {
    const screen = render(
      <Field label="Cửa hàng" labelNativeID="store-label">
        <Select>
          <SelectTrigger accessibilityLabel="Store" accessibilityLabelledBy="other-label" testID="trigger">
            <SelectValue placeholder="Chọn" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );
    const trigger = screen.getByTestId('trigger');
    expect(trigger.props.accessibilityLabel).toBe('Store');
    expect(trigger.props.accessibilityLabelledBy).toBe('other-label');
  });

  it('keeps the placeholder fallback name outside a Field', () => {
    const screen = render(
      <Select>
        <SelectTrigger testID="trigger">
          <SelectValue placeholder="Chọn cửa hàng" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByTestId('trigger');
    expect(trigger.props.accessibilityLabel).toBe('Chọn cửa hàng');
    expect(trigger.props.accessibilityLabelledBy).toBeUndefined();
    expect(trigger.props['aria-required']).toBeUndefined();
  });
});

describe('a bare SelectValue shows the built-in placeholder in the Select locale', () => {
  function BareSelect({ locale }: { locale?: string }) {
    return (
      <Select locale={locale}>
        <SelectTrigger testID="trigger">
          <SelectValue testID="value" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  it('is English by default', () => {
    const screen = render(<BareSelect />);
    expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Select an option');
  });

  it('follows an explicit locale', () => {
    const screen = render(<BareSelect locale="vi-VN" />);
    expect(screen.getByTestId('value')).toHaveTextContent('Chọn một mục');
    expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Chọn một mục');
  });

  it('falls back to English for a locale it has no copy for', () => {
    const screen = render(<BareSelect locale="fr-FR" />);
    expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
  });

  it('never overrides a caller placeholder, including an explicit null', () => {
    const screen = render(
      <Select locale="vi-VN">
        <SelectTrigger accessibilityLabel="Store">
          <SelectValue placeholder={null} testID="value" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByTestId('value')).not.toHaveTextContent('Chọn một mục');
  });
});
