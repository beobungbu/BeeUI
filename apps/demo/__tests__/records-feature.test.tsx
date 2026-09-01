import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import { RecordsScreen } from '../src/features/records/records-screen';
import { DemoScenarioProvider, type DemoScenario } from '../src/state/demo-scenario';

const mockPush = jest.fn();
const mockShow = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../src/shell/responsive-nav', () => ({
  ...jest.requireActual('../src/shell/responsive-nav'),
  useShellLayoutClass: () => 'expanded',
}));

jest.mock('@beemvp/beeui-ui', () => {
  const actual = jest.requireActual('@beemvp/beeui-ui');
  return {
    ...actual,
    useToast: () => ({ show: mockShow, dismiss: jest.fn(), dismissAll: jest.fn() }),
  };
});

function renderRecords(initialScenario?: DemoScenario) {
  return render(
    <BeeUIProvider>
      <DemoScenarioProvider initialScenario={initialScenario}>
        <RecordsScreen />
      </DemoScenarioProvider>
    </BeeUIProvider>,
  );
}

describe('RecordsScreen (#260)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockShow.mockClear();
  });

  it('lists tickets after loading', async () => {
    renderRecords();

    expect(await screen.findByTestId('records-table')).toBeTruthy();
    expect(screen.getByText('TCK-10482')).toBeTruthy();
  });

  it('filters rows by search query, showing a no-results state for an unmatched query', async () => {
    renderRecords();
    await screen.findByTestId('records-table');

    fireEvent.changeText(screen.getByLabelText('Search tickets'), 'nonexistent-ticket-xyz');

    expect(await screen.findByTestId('records-no-results-state')).toBeTruthy();

    fireEvent.press(screen.getByText('Clear filters'));
    expect(await screen.findByTestId('records-table')).toBeTruthy();
  });

  it('filters rows by search query matching a real ticket id', async () => {
    renderRecords();
    await screen.findByTestId('records-table');

    fireEvent.changeText(screen.getByLabelText('Search tickets'), 'TCK-10461');

    await waitFor(() => expect(screen.queryByText('TCK-10482')).toBeNull());
    expect(screen.getByText('TCK-10461')).toBeTruthy();
  });

  it('toggles sort direction on the Updated column', async () => {
    renderRecords();
    await screen.findByTestId('records-table');

    const updatedHeader = screen.getByText('Updated');
    fireEvent.press(updatedHeader);
    fireEvent.press(updatedHeader);

    // After two presses (descending -> ascending) the caption still reflects the full set.
    expect(screen.getByText('12 tickets')).toBeTruthy();
  });

  it('selects a row via its checkbox and shows the selection count', async () => {
    renderRecords();
    await screen.findByTestId('records-table');

    fireEvent.press(screen.getByLabelText('Select TCK-10482'));

    expect(await screen.findByTestId('records-selection-count')).toBeTruthy();
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('navigates to the record detail route when a ticket link is pressed', async () => {
    renderRecords();
    await screen.findByTestId('records-table');

    fireEvent.press(screen.getByLabelText(/Open TCK-10482/));

    expect(mockPush).toHaveBeenCalledWith('/records/TCK-10482');
  });

  it('renders an EmptyState when there are no tickets at all', async () => {
    renderRecords('empty');

    expect(await screen.findByTestId('records-empty-state')).toBeTruthy();
  });

  it('renders an ErrorState with a retry action on failure', async () => {
    renderRecords('error');

    expect(await screen.findByTestId('records-error-state')).toBeTruthy();

    fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByTestId('records-error-state')).toBeTruthy();
  });
});
