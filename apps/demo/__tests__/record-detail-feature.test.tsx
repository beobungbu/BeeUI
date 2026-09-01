import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import { RecordDetailScreen } from '../src/features/record-detail/record-detail-screen';
import { DemoScenarioProvider, type DemoScenario } from '../src/state/demo-scenario';
import { getTicketById, updateTicketFixture } from '../src/features/records/tickets-data';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockShow = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ id: 'TCK-10482' }),
}));

jest.mock('@beemvp/beeui-ui', () => {
  const actual = jest.requireActual('@beemvp/beeui-ui');
  return {
    ...actual,
    useToast: () => ({ show: mockShow, dismiss: jest.fn(), dismissAll: jest.fn() }),
  };
});

function renderDetail(initialScenario?: DemoScenario) {
  return render(
    <BeeUIProvider>
      <DemoScenarioProvider initialScenario={initialScenario}>
        <RecordDetailScreen />
      </DemoScenarioProvider>
    </BeeUIProvider>,
  );
}

describe('RecordDetailScreen (#261)', () => {
  const originalTicket = { ...(getTicketById('TCK-10482') as NonNullable<ReturnType<typeof getTicketById>>) };

  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockShow.mockClear();
    updateTicketFixture('TCK-10482', originalTicket);
  });

  it('renders the read view for the routed ticket id', async () => {
    renderDetail();

    expect(await screen.findByTestId('record-detail-view')).toBeTruthy();
    expect(screen.getByText(originalTicket.subject)).toBeTruthy();
  });

  it('renders a not-found state for an unknown scenario outcome', async () => {
    renderDetail('empty');

    expect(await screen.findByTestId('record-detail-not-found')).toBeTruthy();
  });

  it('renders an ErrorState with retry on failure', async () => {
    renderDetail('error');

    expect(await screen.findByTestId('record-detail-error-state')).toBeTruthy();

    fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByTestId('record-detail-error-state')).toBeTruthy();
  });

  it('enters edit mode, validates required fields, and blocks an invalid save', async () => {
    renderDetail();
    await screen.findByTestId('record-detail-view');

    fireEvent.press(screen.getByText('Edit'));
    expect(await screen.findByTestId('record-detail-edit-form')).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue(originalTicket.subject), '');
    fireEvent.press(screen.getByText('Save changes'));

    expect(await screen.findByText('Subject is required.')).toBeTruthy();
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('saves a valid edit and shows a success toast', async () => {
    renderDetail();
    await screen.findByTestId('record-detail-view');

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByTestId('record-detail-edit-form');

    fireEvent.changeText(screen.getByDisplayValue(originalTicket.subject), 'Updated subject for regression test');
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(screen.getByTestId('record-detail-view')).toBeTruthy());
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ticket saved', variant: 'success' }),
    );
    expect(screen.getByText('Updated subject for regression test')).toBeTruthy();
  });

  it('asks for discard confirmation when cancelling with unsaved changes', async () => {
    renderDetail();
    await screen.findByTestId('record-detail-view');

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByTestId('record-detail-edit-form');

    fireEvent.changeText(screen.getByDisplayValue(originalTicket.subject), 'A dirty unsaved change');
    fireEvent.press(screen.getByText('Cancel'));

    expect(await screen.findByText('Discard changes?')).toBeTruthy();

    fireEvent.press(screen.getByText('Discard'));

    await waitFor(() => expect(screen.getByTestId('record-detail-view')).toBeTruthy());
    expect(screen.getByText(originalTicket.subject)).toBeTruthy();
  });
});
