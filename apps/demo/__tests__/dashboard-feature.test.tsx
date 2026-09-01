import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Button } from '@beemvp/beeui-ui';
import { DashboardScreen } from '../src/features/dashboard/dashboard-screen';
import { DemoScenarioProvider, useDemoScenario, type DemoScenario } from '../src/state/demo-scenario';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function ScenarioSwitch({ to }: { to: DemoScenario }) {
  const { setScenario } = useDemoScenario();
  return <Button onPress={() => setScenario(to)}>{`Switch to ${to}`}</Button>;
}

function renderDashboard(initialScenario?: DemoScenario) {
  return render(
    <DemoScenarioProvider initialScenario={initialScenario}>
      <ScenarioSwitch to="normal" />
      <DashboardScreen />
    </DemoScenarioProvider>,
  );
}

describe('DashboardScreen (#259)', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('shows a loading skeleton, then the success summary and activity feed', async () => {
    renderDashboard();

    expect(await screen.findByTestId('dashboard-summary')).toBeTruthy();
    expect(screen.getByText('47')).toBeTruthy();
    expect(screen.getByTestId('dashboard-activity-timeline')).toBeTruthy();
    expect(screen.getByText('TCK-10482 escalated to Platform Reliability')).toBeTruthy();
  });

  it('navigates to the records tab from the activity section action', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-summary');

    fireEvent.press(screen.getByText('View all tickets'));

    expect(mockPush).toHaveBeenCalledWith('/records');
  });

  it('deep-links an activity entry straight to its ticket (#237 dashboard -> record flow)', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-activity-timeline');

    fireEvent.press(screen.getByLabelText('Open TCK-10482'));

    expect(mockPush).toHaveBeenCalledWith('/records/TCK-10482');
  });

  it('renders an EmptyState for a freshly seeded workspace', async () => {
    renderDashboard('empty');

    expect(await screen.findByTestId('dashboard-empty-state')).toBeTruthy();
  });

  it('renders an ErrorState with a retry action wired to the async lifecycle', async () => {
    renderDashboard('error');

    expect(await screen.findByTestId('dashboard-error-state')).toBeTruthy();

    // Pressing retry re-runs the same failing fetch: it must return to the error
    // state rather than getting stuck in `loading` or throwing.
    fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByTestId('dashboard-error-state')).toBeTruthy();
  });

  it('recovers to the success view once the underlying data scenario changes', async () => {
    renderDashboard('error');
    await screen.findByTestId('dashboard-error-state');

    fireEvent.press(screen.getByText('Switch to normal'));

    await waitFor(() => expect(screen.getByTestId('dashboard-summary')).toBeTruthy());
  });
});
