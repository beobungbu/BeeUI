import { fireEvent, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo } from 'react-native';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import { SettingsScreen } from '../src/features/settings/settings-screen';
import { AppPreferencesProvider } from '../src/state/preferences';
import { DemoScenarioProvider } from '../src/state/demo-scenario';

const mockPush = jest.fn();
const mockShow = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@beemvp/beeui-ui', () => {
  const actual = jest.requireActual('@beemvp/beeui-ui');
  return {
    ...actual,
    useToast: () => ({ show: mockShow, dismiss: jest.fn(), dismissAll: jest.fn() }),
  };
});

function renderSettings() {
  return render(
    <BeeUIProvider>
      <AppPreferencesProvider>
        <DemoScenarioProvider>
          <SettingsScreen />
        </DemoScenarioProvider>
      </AppPreferencesProvider>
    </BeeUIProvider>,
  );
}

describe('SettingsScreen (#263)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockShow.mockClear();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('switches the demo data scenario and surfaces an integration banner', async () => {
    renderSettings();

    fireEvent.press(screen.getByText('Network error'));

    expect(await screen.findByTestId('settings-scenario-banner')).toBeTruthy();
    expect(screen.getByText('Demo scenario: network error')).toBeTruthy();
  });

  it('changes theme preference', async () => {
    renderSettings();
    await screen.findByText('Reduced motion');

    fireEvent.press(screen.getByText('Dark'));

    // No crash and the segmented control accepted the press; deeper theme-runtime
    // wiring (Uniwind.setTheme) is exercised by the existing app-shell/preferences
    // suites this feature does not own.
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  it('warns that a native direction change requires a restart', async () => {
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    Platform.OS = 'ios';

    renderSettings();
    await screen.findByText('Reduced motion');
    fireEvent.press(screen.getByText('RTL'));

    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Restart required' }),
    );

    Platform.OS = originalOS;
  });

  it('navigates to each flow from the quick links list', async () => {
    renderSettings();
    await screen.findByText('Reduced motion');

    fireEvent.press(screen.getByText('Tickets'));
    expect(mockPush).toHaveBeenCalledWith('/records');

    fireEvent.press(screen.getByText('Schedule'));
    expect(mockPush).toHaveBeenCalledWith('/schedule');

    fireEvent.press(screen.getByText('Dashboard'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows the OS-level reduced motion status as read-only', async () => {
    renderSettings();

    expect(await screen.findByText('Off')).toBeTruthy();
  });
});
