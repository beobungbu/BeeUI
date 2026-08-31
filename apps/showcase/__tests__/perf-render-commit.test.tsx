import {
  Badge,
  Button,
  Calendar,
  Field,
  FormGroup,
  Input,
  ListGroup,
  ListItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
  BeeUIProvider,
} from '@beemvp/beeui-ui';
import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import { sampleWorkload } from '../perf/sample-workload';
import { writeRawScenarioRecords, type RawScenarioRecord } from '../perf/scenario-recorder';

// BeeUI R5.2 (#180) — render/commit stress benchmarks, extending the #179
// benchmark harness. These are the honest scenarios that #180 asks for
// (Buttons/Badges, ListItem/SettingsItem, a settings/form screen, 20+
// Selects, a 100+-option Select, Table 100/500 rows, a Calendar month grid,
// and Toast queue churn), mounted as REAL BeeUI component trees through
// `@testing-library/react-native` (the only place in this repo that can
// mount them — see `scripts/benchmark/collect-component-results.mjs` for why
// this is not a plain-Node scenario). Each scenario records BOTH an initial
// mount and an update/re-render cost, per #180's "not only initial mount"
// requirement.
//
// `pnpm --filter @beemvp/beeui-showcase bench` runs this file (and its #181/#182
// siblings) and writes raw per-scenario durations to
// `.artifacts/benchmark/raw/`; `pnpm bench:components` (root) additionally
// turns those into the harness's schema-conformant result set.

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof RNView>) => (
        <RNView ref={ref} {...props}>
          {children}
        </RNView>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const HOST_RECT = { x: 0, y: 0, width: 390, height: 844 };

const records: RawScenarioRecord[] = [];

function record(entry: RawScenarioRecord) {
  records.push(entry);
}

// Real mount cost: render a fresh tree per measured sample, then unmount so
// each sample pays the full commit cost (not amortized reconciliation).
function benchMount(
  id: string,
  title: string,
  description: string,
  factory: () => React.ReactElement,
  { warmup = 8, samples = 20 }: { warmup?: number; samples?: number } = {},
) {
  const durations = sampleWorkload({
    warmup,
    samples,
    fn: () => {
      const screen = render(factory());
      screen.unmount();
    },
  });
  record({
    id,
    title,
    platform: 'web',
    unit: 'ms/mount',
    description,
    warmup,
    samples,
    iterations: 1,
    candidate: { label: 'beeui', durations },
  });
}

// Real update cost: mount once, then measure repeated `rerender` commits
// against the SAME tree (React's update path, not initial mount).
function benchUpdate(
  id: string,
  title: string,
  description: string,
  initial: React.ReactElement,
  updateFactory: (iteration: number) => React.ReactElement,
  { warmup = 8, samples = 20 }: { warmup?: number; samples?: number } = {},
) {
  const screen = render(initial);
  const durations = sampleWorkload({
    warmup,
    samples,
    fn: (i) => {
      screen.rerender(updateFactory(i));
    },
  });
  screen.unmount();
  record({
    id,
    title,
    platform: 'web',
    unit: 'ms/update',
    description,
    warmup,
    samples,
    iterations: 1,
    candidate: { label: 'beeui', durations },
  });
}

function ButtonRow({ count, variant }: { count: number; variant: 'primary' | 'secondary' }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <Button key={i} onPress={() => undefined} variant={variant}>
          {`Action ${i}`}
        </Button>
      ))}
    </View>
  );
}

function BadgeRow({ count, variant }: { count: number; variant: 'default' | 'success' }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <Badge key={i} variant={variant}>
          {`Tag ${i}`}
        </Badge>
      ))}
    </View>
  );
}

function ListItemRows({ count, marker }: { count: number; marker: string }) {
  return (
    <ListGroup>
      {Array.from({ length: count }, (_, i) => (
        <ListItem key={i} title={`${marker} row ${i}`} description="Supporting detail" />
      ))}
    </ListGroup>
  );
}

function SettingsItemRows({ count, marker }: { count: number; marker: string }) {
  return (
    <ListGroup>
      {Array.from({ length: count }, (_, i) => (
        <SettingsItem key={i} title={`${marker} setting ${i}`} value={i % 2 === 0 ? 'On' : 'Off'} />
      ))}
    </ListGroup>
  );
}

function SettingsFormScreen({ marker }: { marker: string }) {
  return (
    <View>
      <FormGroup>
        {Array.from({ length: 8 }, (_, i) => (
          <Field key={i} label={`${marker} field ${i}`}>
            <Input defaultValue="" placeholder="Value" />
          </Field>
        ))}
      </FormGroup>
      <ListGroup>
        {Array.from({ length: 10 }, (_, i) => (
          <SettingsItem
            key={i}
            title={`${marker} preference ${i}`}
            trailing={<Switch value={i % 2 === 0} onValueChange={() => undefined} />}
          />
        ))}
      </ListGroup>
    </View>
  );
}

function ManySelects({ count }: { count: number }) {
  return (
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
      <View>
        {Array.from({ length: count }, (_, i) => (
          <Select key={i}>
            <SelectTrigger>
              <SelectValue placeholder={`Choose option ${i}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Option A</SelectItem>
              <SelectItem value="b">Option B</SelectItem>
            </SelectContent>
          </Select>
        ))}
      </View>
    </OverlayRuntimeProvider>
  );
}

function SelectWithManyOptions({ optionCount }: { optionCount: number }) {
  return (
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
      <Select defaultOpen>
        <SelectTrigger testID="trigger">
          <SelectValue placeholder="Choose one" />
        </SelectTrigger>
        <SelectContent testID="content">
          {Array.from({ length: optionCount }, (_, i) => (
            <SelectItem key={i} value={`option-${i}`}>
              {`Option ${i}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </OverlayRuntimeProvider>
  );
}

function TableRows({ rowCount, marker }: { rowCount: number; marker: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rowCount }, (_, i) => (
          <TableRow key={i}>
            <TableCell>{`${marker}-${i}`}</TableCell>
            <TableCell>{`$${i}.00`}</TableCell>
            <TableCell>{i % 2 === 0 ? 'Paid' : 'Pending'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CalendarScreen({ month }: { month: number }) {
  const [visibleMonth, setVisibleMonth] = React.useState({ month, year: 2026 });
  return (
    <Calendar
      onVisibleMonthChange={setVisibleMonth}
      testID="calendar"
      value={null}
      visibleMonth={visibleMonth}
    />
  );
}

function ToastHarness({ capture }: { capture: (api: ReturnType<typeof useToast>) => void }) {
  capture(useToast());
  return null;
}

describe('BeeUI #180 render/commit stress benchmarks', () => {
  afterAll(() => {
    writeRawScenarioRecords('render-commit.json', records);
  });

  it('Buttons: 100/500 mount + update', () => {
    benchMount(
      'web/render/buttons-100-mount',
      'Mount 100 Buttons',
      'Initial mount of 100 primary Buttons in a plain View, representative of a dense action list.',
      () => <ButtonRow count={100} variant="primary" />,
    );
    benchMount(
      'web/render/buttons-500-mount',
      'Mount 500 Buttons',
      'Initial mount of 500 primary Buttons — upper-bound stress case for #180.',
      () => <ButtonRow count={500} variant="primary" />,
      { samples: 12 },
    );
    benchUpdate(
      'web/render/buttons-100-update',
      'Update 100 Buttons (variant toggle)',
      'Re-render 100 Buttons toggling variant primary/secondary every sample — update path, not mount.',
      <ButtonRow count={100} variant="primary" />,
      (i) => <ButtonRow count={100} variant={i % 2 === 0 ? 'secondary' : 'primary'} />,
    );
  });

  it('Badges: 100/500 mount', () => {
    benchMount(
      'web/render/badges-100-mount',
      'Mount 100 Badges',
      'Initial mount of 100 Badges, representative of a tag-heavy list.',
      () => <BadgeRow count={100} variant="default" />,
    );
    benchMount(
      'web/render/badges-500-mount',
      'Mount 500 Badges',
      'Initial mount of 500 Badges — upper-bound stress case for #180.',
      () => <BadgeRow count={500} variant="default" />,
      { samples: 12 },
    );
  });

  it('ListItems: 100/500 mount + update', () => {
    benchMount(
      'web/render/list-items-100-mount',
      'Mount 100 ListItems',
      'Initial mount of a 100-row ListGroup, representative of a settings/index list.',
      () => <ListItemRows count={100} marker="Item" />,
    );
    benchMount(
      'web/render/list-items-500-mount',
      'Mount 500 ListItems',
      'Initial mount of a 500-row ListGroup — upper-bound stress case for #180.',
      () => <ListItemRows count={500} marker="Item" />,
      { samples: 12 },
    );
    benchUpdate(
      'web/render/list-items-100-update',
      'Update 100 ListItems (content change)',
      'Re-render a 100-row ListGroup with changed row titles every sample — update path.',
      <ListItemRows count={100} marker="Item" />,
      (i) => <ListItemRows count={100} marker={`Item-${i}`} />,
    );
  });

  it('SettingsItems: 100/500 mount', () => {
    benchMount(
      'web/render/settings-items-100-mount',
      'Mount 100 SettingsItems',
      'Initial mount of a 100-row SettingsItem list.',
      () => <SettingsItemRows count={100} marker="Setting" />,
    );
    benchMount(
      'web/render/settings-items-500-mount',
      'Mount 500 SettingsItems',
      'Initial mount of a 500-row SettingsItem list — upper-bound stress case for #180.',
      () => <SettingsItemRows count={500} marker="Setting" />,
      { samples: 12 },
    );
  });

  it('a representative settings/form screen mounts', () => {
    benchMount(
      'web/render/settings-form-screen-mount',
      'Mount a representative settings/form screen',
      'FormGroup with 8 labeled Inputs plus a 10-row SettingsItem list with Switch trailing controls — a realistic composed screen, not a synthetic single-component stress case.',
      () => <SettingsFormScreen marker="Profile" />,
      { warmup: 10, samples: 24 },
    );
  });

  it('20+ Selects mount together', () => {
    benchMount(
      'web/render/selects-24-mount',
      'Mount 24 closed Selects',
      '24 independent Select components (closed), representative of a filter bar or a long form with many pickers.',
      () => <ManySelects count={24} />,
      { warmup: 10, samples: 20 },
    );
  });

  it('a Select with 100+ options mounts open', () => {
    benchMount(
      'web/render/select-120-options-mount',
      'Mount an open Select with 120 options',
      'A single Select rendered open (defaultOpen) with 120 SelectItem options — render/commit cost of a large option list, distinct from #181s trigger-to-visible latency metric.',
      () => <SelectWithManyOptions optionCount={120} />,
      { warmup: 8, samples: 16 },
    );
  });

  it('Table: 100/500 rows mount', () => {
    benchMount(
      'web/render/table-100-rows-mount',
      'Mount a 100-row Table',
      'Initial mount of a 100-row/3-column Table.',
      () => <TableRows rowCount={100} marker="row" />,
    );
    benchMount(
      'web/render/table-500-rows-mount',
      'Mount a 500-row Table',
      'Initial mount of a 500-row/3-column Table — upper-bound stress case for #180.',
      () => <TableRows rowCount={500} marker="row" />,
      { samples: 10 },
    );
  });

  it('Calendar month grid mounts + navigates', () => {
    benchMount(
      'web/render/calendar-month-mount',
      'Mount a Calendar month grid',
      'Initial mount of a full month grid (5-6 week rows) via Calendar.',
      () => <CalendarScreen month={1} />,
      { warmup: 10, samples: 24 },
    );
    const screen = render(<CalendarScreen month={1} />);
    const durations = sampleWorkload({
      warmup: 10,
      samples: 24,
      fn: (i) => {
        act(() => {
          screen.rerender(<CalendarScreen month={((i % 11) + 1) as number} />);
        });
      },
    });
    screen.unmount();
    record({
      id: 'web/render/calendar-month-navigate-update',
      title: 'Navigate Calendar between months',
      platform: 'web',
      unit: 'ms/update',
      description: 'Re-render Calendar with a new controlled visibleMonth every sample — month-navigation update cost.',
      warmup: 10,
      samples: 24,
      iterations: 1,
      candidate: { label: 'beeui', durations },
    });
  });

  it('Toast queue churn (push at capacity)', () => {
    let api: ReturnType<typeof useToast> | null = null;
    const screen = render(
      <BeeUIProvider syncUniwindInsets={false}>
        <ToastHarness capture={(value) => { api = value; }} />
      </BeeUIProvider>,
    );
    if (!api) throw new Error('toast api was not captured');
    const toastApi = api as ReturnType<typeof useToast>;

    const durations = sampleWorkload({
      warmup: 10,
      samples: 30,
      fn: (i) => {
        act(() => {
          toastApi.show({ title: `Update ${i}` });
        });
      },
    });
    screen.unmount();
    record({
      id: 'web/render/toast-queue-churn',
      title: 'Toast queue churn at capacity',
      platform: 'web',
      unit: 'ms/op',
      description:
        'Repeatedly push a toast onto an already-populated queue, exercising eviction/reflow at TOAST_MAX_VISIBLE capacity.',
      warmup: 10,
      samples: 30,
      iterations: 1,
      candidate: { label: 'beeui', durations },
    });
  });
});
