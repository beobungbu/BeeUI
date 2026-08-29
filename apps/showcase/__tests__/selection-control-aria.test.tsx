import {
  Checkbox,
  Chip,
  ChipGroup,
  Radio,
  RadioGroup,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@beeui/ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, Switch as RNSwitch } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// Full trigger+content trees below need the anchored-overlay runtime context
// (SelectContent portals through it even while closed, and SelectItem's
// registration effect -- which is what populates `selectedItem` -- runs on
// mount regardless of open state). `react-native-teleport` and
// `react-native-safe-area-context` aren't available as real native modules
// under Jest, so they're mocked the same way the existing Select test suite
// (wave-2a-select.test.tsx) mocks them.
jest.mock('react-native-teleport', () => {
  return {
    PortalProvider: ({ children }: { children?: React.ReactNode }) => children,
    PortalHost: () => null,
    Portal: ({ children }: { children?: React.ReactNode }) => children,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
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

const SELECT_HOST_RECT = { x: 0, y: 0, width: 320, height: 240 };

// react-native's own `Pressable` normalizes `aria-checked` into
// `accessibilityState.checked` before it ever reaches a host node (see
// react-native/Libraries/Components/Pressable/Pressable.js), and
// `@testing-library/react-native`'s query helpers (`getByRole`,
// `UNSAFE_getByType`, `root.findAll*`) only resolve *host* elements, which
// filters `Pressable` itself out of the tree entirely. That normalization
// is correct for native platforms, but it means neither of those can prove
// what our components hand `Pressable` as a raw prop -- and that raw prop
// is exactly the contract react-native-web's *own*, differently-implemented
// `Pressable` reads to build the DOM `aria-checked` attribute (verified
// against the compiled Web output; react-native-web does not forward
// `accessibilityState` to the DOM at all). We render with raw
// `react-test-renderer` for these cases so the assertions inspect the
// actual props passed to the composite `Pressable`, which is the real
// contract boundary this fix corrects.
//
// `packages/ui` and `apps/showcase` each resolve their own `react-native`
// peer-dependency instance under pnpm, so the `Pressable` reference the
// test imports is not `===` the one `@beeui/ui` renders with -- matching
// by type reference silently finds nothing. Match by the stable
// `displayName`/`name` instead, which is identical across both instances.
function isPressableInstance(node: ReactTestInstance): boolean {
  if (typeof node.type === 'string') return false;
  const type = node.type as { displayName?: string; name?: string };
  return (type.displayName ?? type.name) === 'Pressable';
}

function renderComposite(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function findPressable(renderer: ReactTestRenderer): ReactTestInstance {
  const matches = renderer.root.findAll(isPressableInstance);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Pressable, found ${matches.length}`);
  }
  return matches[0];
}

function findAllPressables(renderer: ReactTestRenderer): ReactTestInstance[] {
  return renderer.root.findAll(isPressableInstance);
}

describe('BeeUI selection control ARIA state and name contracts', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  describe('Checkbox', () => {
    it('passes a checked value through as the aria-checked prop', () => {
      const renderer = renderComposite(
        <Checkbox checked label="Accept terms" onCheckedChange={() => {}} />,
      );
      const control = findPressable(renderer);

      expect(control.props.accessibilityState.checked).toBe(true);
      expect(control.props['aria-checked']).toBe(true);
    });

    it('passes an unchecked value through as the aria-checked prop', () => {
      const renderer = renderComposite(
        <Checkbox checked={false} label="Accept terms" onCheckedChange={() => {}} />,
      );
      const control = findPressable(renderer);

      expect(control.props['aria-checked']).toBe(false);
    });

    it('passes the indeterminate value through as aria-checked="mixed"', () => {
      const renderer = renderComposite(
        <Checkbox checked="indeterminate" label="Select all" onCheckedChange={() => {}} />,
      );
      const control = findPressable(renderer);

      expect(control.props.accessibilityState.checked).toBe('mixed');
      expect(control.props['aria-checked']).toBe('mixed');
    });
  });

  describe('Radio', () => {
    it('passes the selected option through as aria-checked for every radio in the group', () => {
      const renderer = renderComposite(
        <RadioGroup onValueChange={() => {}} value="pro">
          <Radio label="Starter plan" value="starter" />
          <Radio label="Pro plan" value="pro" />
        </RadioGroup>,
      );
      const [starter, pro] = findAllPressables(renderer);

      expect(starter.props['aria-checked']).toBe(false);
      expect(pro.props['aria-checked']).toBe(true);
    });
  });

  describe('SegmentedControlItem', () => {
    it('passes the selected segment through as aria-checked', () => {
      const renderer = renderComposite(
        <SegmentedControl onValueChange={() => {}} value="list">
          <SegmentedControlItem value="list">List</SegmentedControlItem>
          <SegmentedControlItem value="grid">Grid</SegmentedControlItem>
        </SegmentedControl>,
      );
      const [list, grid] = findAllPressables(renderer);

      expect(list.props['aria-checked']).toBe(true);
      expect(grid.props['aria-checked']).toBe(false);
    });
  });

  describe('Chip (grouped selection control)', () => {
    it('passes selected state through as aria-checked for a multi-select ChipGroup', () => {
      const renderer = renderComposite(
        <ChipGroup onValueChange={() => {}} selectionMode="multiple" value={['mobile']}>
          <Chip value="mobile">Mobile</Chip>
          <Chip value="web">Web</Chip>
        </ChipGroup>,
      );
      const [mobile, web] = findAllPressables(renderer);

      expect(mobile.props['aria-checked']).toBe(true);
      expect(web.props['aria-checked']).toBe(false);
    });

    it('passes selected state through as aria-checked for a single-select ChipGroup', () => {
      const renderer = renderComposite(
        <ChipGroup onValueChange={() => {}} selectionMode="single" value="starter">
          <Chip value="starter">Starter</Chip>
          <Chip value="pro">Pro</Chip>
        </ChipGroup>,
      );
      const [starter, pro] = findAllPressables(renderer);

      expect(starter.props['aria-checked']).toBe(true);
      expect(pro.props['aria-checked']).toBe(false);
    });

    it('does not set aria-checked on an ungrouped Chip, which is a plain toggle button', () => {
      const renderer = renderComposite(<Chip onSelectedChange={() => {}}>Standalone</Chip>);
      const control = findPressable(renderer);

      expect(control.props['aria-checked']).toBeUndefined();
    });
  });

  describe('Switch', () => {
    it('keeps accessibilityRole="switch" and accessibilityState on native platforms', () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      const screen = render(<Switch accessibilityLabel="Notifications" onValueChange={() => {}} value />);
      const control = screen.UNSAFE_getByType(RNSwitch);

      expect(control.props.accessibilityRole).toBe('switch');
      expect(control.props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    });

    it('omits accessibilityRole/role on Web to avoid a nested role="switch" the engine cannot mark up with aria-checked', () => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      const screen = render(<Switch accessibilityLabel="Notifications" onValueChange={() => {}} value />);
      const control = screen.UNSAFE_getByType(RNSwitch);

      // react-native-web's own <Switch> spreads any accessibilityRole/role
      // straight onto the outer wrapper it renders, which already wraps an
      // inner native `<input role="switch">` used for real interaction.
      // Forwarding a role here recreates two nested role="switch" elements
      // (nested-interactive) where the outer one also lacks aria-checked
      // (aria-required-attr), because react-native-web does not forward
      // accessibilityState to the DOM. The prop must be entirely absent on
      // Web, not merely falsy, so the platform's own single native control
      // is the sole interactive element.
      expect('accessibilityRole' in control.props).toBe(false);
      expect('role' in control.props).toBe(false);
    });
  });

  describe('Select trigger accessible name', () => {
    it('falls back to the SelectValue placeholder when no accessibilityLabel is provided', () => {
      const screen = render(
        <Select>
          <SelectTrigger testID="trigger">
            <SelectValue placeholder="Root Select" />
          </SelectTrigger>
        </Select>,
      );

      expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Root Select');
    });

    it('falls back to a generic default name when SelectValue has no custom placeholder', () => {
      const screen = render(
        <Select>
          <SelectTrigger testID="trigger">
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );

      expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Select an option');
    });

    it('falls back to a generic default name for custom, non-SelectValue trigger content', () => {
      const screen = render(
        <Select>
          <SelectTrigger testID="trigger">
            <React.Fragment>Custom content</React.Fragment>
          </SelectTrigger>
        </Select>,
      );

      expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Select an option');
    });

    it('prefers an explicit accessibilityLabel over the placeholder fallback', () => {
      const screen = render(
        <Select>
          <SelectTrigger accessibilityLabel="Account plan" testID="trigger">
            <SelectValue placeholder="Choose a plan" />
          </SelectTrigger>
        </Select>,
      );

      expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Account plan');
    });

    it('does not set a fallback accessibilityLabel when the trigger is labelled by another element', () => {
      const screen = render(
        <Select>
          <SelectTrigger accessibilityLabelledBy="external-label" testID="trigger">
            <SelectValue placeholder="Choose a plan" />
          </SelectTrigger>
        </Select>,
      );

      expect(screen.getByTestId('trigger').props.accessibilityLabel).toBeUndefined();
      expect(screen.getByTestId('trigger').props.accessibilityLabelledBy).toBe('external-label');
    });

    // WAI-ARIA APG combobox pattern: the accessible NAME must stay distinct
    // from the selected VALUE. Regression for promoting `selectedItem.textValue`
    // into the fallback accessibilityLabel, which collapsed name and value into
    // the same string (e.g. name "Pro" instead of a stable "Choose a plan").
    // https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
    function PlanSelect({ value }: { value: string }) {
      return (
        <OverlayRuntimeProvider hostRectOverride={SELECT_HOST_RECT}>
          <Select onValueChange={() => {}} value={value}>
            <SelectTrigger testID="trigger">
              <SelectValue placeholder="Choose a plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
        </OverlayRuntimeProvider>
      );
    }

    it('keeps a stable accessible name distinct from the selected value', () => {
      const screen = render(<PlanSelect value="pro" />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger.props.accessibilityLabel).toBe('Choose a plan');
      expect(trigger.props.accessibilityValue.text).toBe('Pro');
      expect(trigger.props.accessibilityLabel).not.toBe(trigger.props.accessibilityValue.text);
    });

    it('keeps the accessible name unchanged when the selected value changes', () => {
      const screen = render(<PlanSelect value="starter" />);
      expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Choose a plan');
      expect(screen.getByTestId('trigger').props.accessibilityValue.text).toBe('Starter');

      screen.rerender(<PlanSelect value="pro" />);

      expect(screen.getByTestId('trigger').props.accessibilityLabel).toBe('Choose a plan');
      expect(screen.getByTestId('trigger').props.accessibilityValue.text).toBe('Pro');
    });
  });
});
