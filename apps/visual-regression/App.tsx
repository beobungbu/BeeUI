import './global.css';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  Badge,
  BeeThemeScope,
  BeeUIProvider,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  FormGroup,
  Input,
  Link,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Progress,
  PasswordInput,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  Radio,
  RadioGroup,
  Separator,
  SettingsItem,
  Stepper,
  StepperItem,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Textarea,
  Timeline,
  TimelineItem,
  useBeeToken,
} from '@beeui/ui';
import { applyDensity, defaultDensityMode, densityModes, type DensityMode } from '@beeui/tokens';
import * as React from 'react';
// #152 — `Tooltip`/`TooltipTrigger`/`TooltipContent` are not yet on the
// `@beeui/ui` public barrel (ADR-005 implementation consequences: exporting a
// Web-only composition from the shared `packages/ui/src/index.ts` barrel would
// break Metro's iOS/Android module resolution for `apps/showcase`, which
// re-exports that same barrel, before #153 adds `tooltip.native.tsx`). This
// fixture is the one deliberate, documented exception to this file's usual
// "from @beeui/ui primitives only" convention — `apps/visual-regression` never
// builds for iOS/Android (`build:web` only), so the deep import is safe here
// and unblocks real browser evidence for #152 without touching the shared
// barrel. Switch back to `@beeui/ui` once #155 exports it.
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../packages/ui/src/components/tooltip.web';
import { Uniwind } from 'uniwind';
import {
  isVisualScenarioId,
  isVisualTheme,
  type VisualScenarioId,
  type VisualTheme,
} from './src/visual-contract';

function readVisualQuery(): { scenario: VisualScenarioId; theme: VisualTheme } {
  if (typeof window === 'undefined') {
    return { scenario: 'foundation', theme: 'light' };
  }

  const params = new URLSearchParams(window.location.search);
  const requestedScenario = params.get('scenario');
  const requestedTheme = params.get('theme');

  return {
    scenario: isVisualScenarioId(requestedScenario) ? requestedScenario : 'foundation',
    theme: isVisualTheme(requestedTheme) ? requestedTheme : 'light',
  };
}

function readHardeningQuery() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('hardening');
}

function readDataTypographyQuery() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('data') === 'typography';
}

// #74/#78/#68/#77 finalization — a fourth, dedicated URL flag (like `hardening`
// and `data=typography` above) for fixtures that are driven by their own
// standalone spec files rather than the canonical `scenario` x `theme` x
// `viewport` matrix. Keeping these OUT of `visualScenarios` is deliberate: that
// array is multiplied by every canonical theme/viewport project, and none of
// these four fixtures need that full cross-product (see each fixture's own
// spec file for exactly which combinations it captures).
type FixtureId =
  | 'density'
  | 'dataviz-brands'
  | 'scoped-preview'
  | 'high-contrast-focus'
  | 'tooltip';

const fixtureIds: readonly FixtureId[] = [
  'density',
  'dataviz-brands',
  'scoped-preview',
  'high-contrast-focus',
  'tooltip',
];

function isFixtureId(value: string | null): value is FixtureId {
  return (fixtureIds as readonly string[]).includes(value ?? '');
}

function readFixtureQuery(): FixtureId | null {
  if (typeof window === 'undefined') return null;
  const requested = new URLSearchParams(window.location.search).get('fixture');
  return isFixtureId(requested) ? requested : null;
}

function readDensityModeQuery(): DensityMode {
  if (typeof window === 'undefined') return defaultDensityMode;
  const requested = new URLSearchParams(window.location.search).get('density');
  return (densityModes as readonly string[]).includes(requested ?? '')
    ? (requested as DensityMode)
    : defaultDensityMode;
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function useVisualReadiness(scenario: VisualScenarioId, theme: VisualTheme) {
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    let cancelled = false;
    document.documentElement.removeAttribute('data-visual-ready');
    document.documentElement.dataset.visualScenario = scenario;
    document.documentElement.dataset.visualTheme = theme;
    Uniwind.setTheme(theme);

    const anchoredTestId =
      scenario === 'popover-open'
        ? 'visual-popover-content'
        : scenario === 'dropdown-menu-open'
          ? 'visual-dropdown-content'
          : undefined;

    async function settle() {
      if ('fonts' in document) {
        await document.fonts.ready;
      }

      await nextFrame();
      await nextFrame();

      if (anchoredTestId) {
        let positioned = false;

        for (let attempt = 0; attempt < 30; attempt += 1) {
          if (cancelled) return;

          const node = document.querySelector(
            `[data-testid="${anchoredTestId}"]`,
          ) as HTMLElement | null;
          const rect = node?.getBoundingClientRect();

          if (
            rect &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.left > -1000 &&
            rect.top > -1000
          ) {
            positioned = true;
            break;
          }

          await nextFrame();
        }

        if (!positioned) return;
      }

      await nextFrame();
      if (!cancelled) document.documentElement.dataset.visualReady = 'true';
    }

    void settle();

    return () => {
      cancelled = true;
    };
  }, [scenario, theme]);
}

function ScenarioShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Box className="min-h-screen bg-surface px-4 py-5">
      <Box className="mx-auto w-full max-w-4xl gap-4">
        <Box className="gap-1">
          <Text variant="title">{title}</Text>
          <Text tone="muted" variant="caption">
            BeeUI deterministic visual fixture
          </Text>
        </Box>
        {children}
      </Box>
    </Box>
  );
}

function FoundationScenario() {
  return (
    <ScenarioShell title="Foundation">
      <Card className="gap-3" variant="raised">
        <Text variant="heading">Type scale</Text>
        <Text variant="title">Title · BeeUI</Text>
        <Text variant="heading">Heading · Visual regression</Text>
        <Text variant="body">Body · Portable React Native primitives</Text>
        <Text variant="label">Label · Deterministic fixture</Text>
        <Text variant="caption">Caption · Chromium baseline</Text>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">Buttons</Text>
        <Box className="flex-row flex-wrap gap-2">
          <Button size="sm">Small</Button>
          <Button size="md" variant="secondary">Medium</Button>
          <Button size="lg" variant="outline">Large</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </Box>
      </Card>

      <Card className="gap-3" variant="muted">
        <Text variant="heading">Badges, card, separator</Text>
        <Box className="flex-row flex-wrap gap-2">
          <Badge>Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Error</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
        </Box>
        <Separator />
        <Text tone="muted">Semantic surfaces stay theme-aware.</Text>
      </Card>
    </ScenarioShell>
  );
}

function FormsScenario() {
  return (
    <ScenarioShell title="Forms">
      <Card className="gap-4">
        <Field description="Used only for release notifications." label="Email" required>
          <Input defaultValue="visual@beeui.dev" />
        </Field>

        <Field description="Fixed multiline content." label="Notes">
          <Textarea defaultValue="Stable content for screenshot comparison." />
        </Field>

        <Field label="Password">
          <PasswordInput defaultValue="beeui-visual" />
        </Field>

        <Separator />

        <Checkbox checked label="Accept release checklist" onCheckedChange={() => undefined} />

        <FormGroup description="One stable selected option." legend="Release channel" required>
          <RadioGroup onValueChange={() => undefined} value="stable">
            <Radio label="Preview" value="preview" />
            <Radio label="Stable" value="stable" />
          </RadioGroup>
        </FormGroup>

        <Box className="flex-row items-center justify-between gap-4">
          <Text>Visual gate enabled</Text>
          <Switch accessibilityLabel="Visual gate enabled" onValueChange={() => undefined} value />
        </Box>
      </Card>
    </ScenarioShell>
  );
}

function NavigationDataScenario() {
  return (
    <ScenarioShell title="Navigation and data">
      <Card className="gap-4">
        <Breadcrumb accessibilityLabel="Visual fixture breadcrumb">
          <BreadcrumbItem onPress={() => undefined}>Components</BreadcrumbItem>
          <BreadcrumbItem current>Visual regression</BreadcrumbItem>
        </Breadcrumb>

        <Tabs onValueChange={() => undefined} value="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Text tone="muted">The active tab is fixed for every run.</Text>
          </TabsContent>
        </Tabs>

        <Stepper currentStep={2} onStepChange={() => undefined}>
          <StepperItem description="Tokens and primitives" step={1} title="Foundation" />
          <StepperItem description="Screenshot harness" step={2} title="Visual gate" />
          <StepperItem description="Future native work" step={3} title="Phase 2" />
        </Stepper>

        <ListGroup>
          <ListGroupHeader description="Stable application-composition rows" title="Workspace" />
          <SettingsItem description="Canonical browser" title="Engine" value="Chromium" />
          <SettingsItem description="Canonical density" title="Pixel ratio" value="1" />
        </ListGroup>

        <Progress accessibilityLabel="Phase 1 coverage" value={72} />

        <Timeline>
          <TimelineItem description="Public component API only." meta="Complete" status="success" title="Fixture" />
          <TimelineItem description="Linux + pinned Chromium baselines." meta="Current" status="primary" title="Comparison" />
          <TimelineItem description="iOS and Android screenshot automation." meta="Phase 2" title="Native expansion" />
        </Timeline>
      </Card>
    </ScenarioShell>
  );
}

function DialogOpenScenario() {
  return (
    <ScenarioShell title="Dialog">
      <Card className="gap-3">
        <Text>Background fixture content remains stable beneath the modal.</Text>
        <Button variant="outline">Background action</Button>
      </Card>

      <Dialog defaultOpen>
        <DialogContent closeOnBackdropPress={false} modalProps={{ animationType: 'none' }}>
          <DialogTitle>Release visual changes?</DialogTitle>
          <DialogDescription>
            Baseline updates must be visually reviewed before they are committed.
          </DialogDescription>
          <Field label="Baseline note">
            <Input defaultValue="Intentional component update" />
          </Field>
          <DialogFooter>
            <DialogClose variant="outline">Cancel</DialogClose>
            <DialogClose>Approve</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScenarioShell>
  );
}

function AlertDialogOpenScenario() {
  return (
    <ScenarioShell title="AlertDialog">
      <Card className="gap-3">
        <Text>Representative destructive confirmation state.</Text>
      </Card>

      <AlertDialog defaultOpen>
        <AlertDialogContent modalProps={{ animationType: 'none' }}>
          <AlertDialogTitle>Replace canonical baseline?</AlertDialogTitle>
          <AlertDialogDescription>
            Only intentional, reviewed visual changes should replace expected pixels.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep baseline</AlertDialogCancel>
            <AlertDialogAction>Replace baseline</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScenarioShell>
  );
}

function PopoverOpenScenario() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    requestAnimationFrame(() => {
      if (active) setOpen(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScenarioShell title="Popover">
      <Card className="min-h-96 items-center justify-center gap-3" variant="raised">
        <Text tone="muted">Fixed centered anchor</Text>
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger variant="outline">Open details</PopoverTrigger>
          <PopoverContent
            align="center"
            closeOnOutsidePress={false}
            placement="bottom"
            sideOffset={12}
            testID="visual-popover-content"
          >
            <PopoverTitle>Deterministic geometry</PopoverTitle>
            <PopoverDescription>
              The anchor, viewport, content, and placement are fixed for this capture.
            </PopoverDescription>
            <PopoverClose size="sm" variant="ghost">Close</PopoverClose>
          </PopoverContent>
        </Popover>
      </Card>
    </ScenarioShell>
  );
}

function DropdownMenuOpenScenario() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    requestAnimationFrame(() => {
      if (active) setOpen(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScenarioShell title="DropdownMenu">
      <Card className="min-h-96 items-center justify-center gap-3" variant="raised">
        <Text tone="muted">Fixed centered menu anchor</Text>
        <DropdownMenu onOpenChange={setOpen} open={open}>
          <DropdownMenuTrigger variant="outline">Release actions</DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            closeOnOutsidePress={false}
            placement="bottom"
            sideOffset={12}
            testID="visual-dropdown-content"
          >
            <DropdownMenuLabel>Baseline</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => undefined}>Review diff</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => undefined}>Open report</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Update in CI</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
    </ScenarioShell>
  );
}

// #77 finalization — a compact, deterministic reconstruction of
// apps/showcase/patterns/auth's sign-in screen, built the same way every other
// scenario in this file is: from @beeui/ui primitives only, with fixed
// content and no cross-app import. Representative of a real Pattern Gallery
// screen (labeled fields, primary action, secondary link) rather than an
// isolated component, so the accessibility axis is proven against composed
// screen layout too, not just Foundation/Forms in isolation.
function PatternSignInScenario() {
  return (
    <ScenarioShell title="Pattern: sign in">
      <Box className="gap-1">
        <Text variant="heading">Welcome back</Text>
        <Text tone="muted" variant="body">
          Use your email and password to continue where you left off.
        </Text>
      </Box>

      <Card className="gap-4" padding="lg" variant="raised">
        <Field label="Email" required>
          <Input defaultValue="visual@beeui.dev" />
        </Field>

        <Box className="gap-2">
          <Field label="Password" required>
            <PasswordInput defaultValue="beeui-visual" />
          </Field>
          <Link className="self-start" onPress={() => undefined}>
            Forgot password?
          </Link>
        </Box>

        <Button onPress={() => undefined} size="lg">
          Sign in
        </Button>
      </Card>

      <Box className="items-center gap-1">
        <Text tone="muted" variant="caption">
          New to BeeUI?
        </Text>
        <Link className="self-center" onPress={() => undefined}>
          Create an account
        </Link>
      </Box>
    </ScenarioShell>
  );
}

// #78 — semantic data-visualization (chart) color tokens. A lightweight,
// dependency-free SVG fixture (raw `<svg>`/`<rect>`/`<line>`/`<text>` DOM
// elements this web app already renders through, no chart library) that
// proves the `chart.*` token contract renders correctly, not a production
// charting component. Deterministic, fixed data — see
// apps/showcase/patterns/dashboard-finance's revenue-mix breakdown (3
// categories) and activity feed (positive/negative direction) for the real
// product evidence this vocabulary is based on.
const CATEGORY_CHART_DATA = [
  { label: 'Subscriptions', value: 54, tokenKey: 'series-1' as const },
  { label: 'Services', value: 29, tokenKey: 'series-2' as const },
  { label: 'Marketplace', value: 17, tokenKey: 'series-3' as const, highlighted: true },
  { label: 'Other', value: 8, tokenKey: 'series-4' as const },
];

const CHART_MAX_VALUE = 54;
const CHART_BAR_WIDTH = 60;
const CHART_BAR_MAX_HEIGHT = 140;
const CHART_BASELINE_Y = 180;
const CHART_GRID_LINE_YS = [40, 80, 120, 160];

function CategoricalBarChart() {
  const seriesColors = {
    'series-1': useBeeToken('chart.series-1'),
    'series-2': useBeeToken('chart.series-2'),
    'series-3': useBeeToken('chart.series-3'),
    'series-4': useBeeToken('chart.series-4'),
  };
  const gridColor = useBeeToken('chart.grid');
  const axisColor = useBeeToken('chart.axis');
  const highlightColor = useBeeToken('chart.highlight');

  return (
    <Box className="gap-2">
      <svg
        aria-label="Revenue mix by category, Marketplace highlighted as the current selection"
        role="img"
        viewBox="0 0 400 210"
      >
        {CHART_GRID_LINE_YS.map((y) => (
          <line key={`grid-${y}`} stroke={gridColor} strokeWidth={1} x1={20} x2={380} y1={y} y2={y} />
        ))}
        <line stroke={axisColor} strokeWidth={2} x1={20} x2={380} y1={CHART_BASELINE_Y} y2={CHART_BASELINE_Y} />

        {CATEGORY_CHART_DATA.map((item, index) => {
          const barHeight = (item.value / CHART_MAX_VALUE) * CHART_BAR_MAX_HEIGHT;
          const x = 40 + index * 90;
          const y = CHART_BASELINE_Y - barHeight;
          return (
            <React.Fragment key={item.label}>
              {item.highlighted ? (
                // Non-color reinforcement for "highlighted": an explicit "Current" text
                // label above the bar, not only a distinct outline color/pattern.
                <text
                  fill={highlightColor}
                  fontSize={11}
                  fontWeight="bold"
                  textAnchor="middle"
                  x={x + CHART_BAR_WIDTH / 2}
                  y={y - 20}
                >
                  Current
                </text>
              ) : null}
              <rect
                fill={seriesColors[item.tokenKey]}
                height={barHeight}
                stroke={item.highlighted ? highlightColor : 'none'}
                strokeDasharray={item.highlighted ? '4 3' : undefined}
                strokeWidth={item.highlighted ? 2 : 0}
                width={CHART_BAR_WIDTH}
                x={x}
                y={y}
              />
              <text fill={axisColor} fontSize={11} textAnchor="middle" x={x + CHART_BAR_WIDTH / 2} y={CHART_BASELINE_Y + 18}>
                {item.label}
              </text>
            </React.Fragment>
          );
        })}
      </svg>
    </Box>
  );
}

function FinanceDeltaRow({
  direction,
  label,
  percent,
}: {
  direction: 'up' | 'down' | 'flat';
  label: string;
  percent: string;
}) {
  const positiveColor = useBeeToken('chart.positive');
  const negativeColor = useBeeToken('chart.negative');
  const neutralColor = useBeeToken('chart.neutral');
  const color = direction === 'up' ? positiveColor : direction === 'down' ? negativeColor : neutralColor;
  // Non-color reinforcement: the sign and arrow glyph carry the meaning in the
  // accessible text itself, independent of `color` — see docs/theming.md's
  // "Data-visualization (chart) tokens" section.
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : '';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '→';

  return (
    <Box className="flex-row items-center justify-between">
      <Text variant="label">{label}</Text>
      <Text
        accessibilityLabel={`${label} ${direction} ${sign}${percent}`}
        style={{ color }}
        variant="label"
      >
        {arrow} {sign}
        {percent}
      </Text>
    </Box>
  );
}

function DataVizScenario() {
  return (
    <ScenarioShell title="Data visualization">
      <Card className="gap-3" padding="lg" variant="raised">
        <Text variant="heading">Revenue mix</Text>
        <Text tone="muted" variant="caption">
          4 categorical series (chart.series-1..4), gridlines (chart.grid), axis (chart.axis), and a
          highlighted current-period bar (chart.highlight) reinforced with a "Current" label.
        </Text>
        <CategoricalBarChart />
      </Card>

      <Card className="gap-3" padding="lg" variant="outlined">
        <Text variant="heading">Weekly change</Text>
        <Text tone="muted" variant="caption">
          Positive/negative/neutral deltas (chart.positive/negative/neutral), each reinforced with a
          sign and arrow glyph independent of color.
        </Text>
        <FinanceDeltaRow direction="up" label="Revenue" percent="12.8%" />
        <FinanceDeltaRow direction="down" label="Expenses" percent="3.1%" />
        <FinanceDeltaRow direction="flat" label="Conversion" percent="0.1%" />
      </Card>
    </ScenarioShell>
  );
}

// #74 — application density semantics. One representative list/table row group
// (ListGroup/ListItem, density's `rowHeight`/`rowGap` metrics) AND one
// representative form/settings group (FormGroup/Field, density's `formGap`
// metric), rendered through the real `applyDensity` runtime mechanism — never
// hand-set pixels. `comfortable` intentionally never calls `applyDensity`: it
// is the baseline default every density-sensitive class already resolves to
// without any override, so this fixture proves the "comfortable matches the
// current default" invariant by construction rather than by a separate
// pixel-diff assertion.
function DensityFixture({ density, theme }: { density: DensityMode; theme: VisualTheme }) {
  React.useEffect(() => {
    if (density !== defaultDensityMode) {
      applyDensity(Uniwind, theme, density);
    }
  }, [density, theme]);

  return (
    <Box className="min-h-screen gap-6 bg-surface p-6" testID="density-fixture">
      <Box className="gap-1">
        <Text variant="title">Density: {density}</Text>
        <Text tone="muted" variant="caption">
          BeeUI issue #74 — compact / comfortable / spacious application density
        </Text>
      </Box>

      <ListGroup testID="density-row-group">
        <ListGroupHeader description="Row height and row gap scale with density" title="Workspace" />
        <ListItem description="Canonical browser" testID="density-row-1" title="Engine" />
        <ListItem description="Deterministic capture" testID="density-row-2" title="Pixel ratio" />
        <ListItem description="Density-sensitive spacing" testID="density-row-3" title="Row height" />
      </ListGroup>

      <Card className="gap-3" padding="lg" variant="raised">
        <FormGroup
          description="Form gap scales with density"
          legend="Notification channel"
          testID="density-form-group"
        >
          <Field label="Email">
            <Input defaultValue="visual@beeui.dev" />
          </Field>
          <Field label="Display name">
            <Input defaultValue="BeeUI" />
          </Field>
        </FormGroup>
      </Card>
    </Box>
  );
}

/**
 * Derives a `BeeThemeScope` `appearance` ('light' | 'dark') from the outer
 * harness `theme`. Only the appearance half of the outer theme matters here —
 * the brand/accessibility axis is what each fixture below is scoping
 * explicitly through `BeeThemeScope` itself.
 */
function appearanceForVisualTheme(theme: VisualTheme): 'light' | 'dark' {
  return theme.endsWith('dark') ? 'dark' : 'light';
}

// #78 — semantic data-visualization (chart) color tokens under Brand B
// (Violet), proven side by side against Brand A (Bee) through `BeeThemeScope`
// rather than by adding `violet-light`/`violet-dark` to the canonical
// `visualThemes` matrix (which every other scenario in this file would also be
// multiplied by). Reuses the exact same `CategoricalBarChart` fixture the
// `dataviz` scenario already renders — `useBeeToken` is scope-aware, so each
// copy resolves its own scoped brand's `chart.*` tokens (see
// `chart.highlight`, which is `violet-500` for Bee and `amber-700` for Violet
// in canonical tokens.json, precisely so it never doubles as the Violet brand
// accent).
function DataVizBrandsFixture({ theme }: { theme: VisualTheme }) {
  const appearance = appearanceForVisualTheme(theme);

  return (
    <ScenarioShell title="Data visualization: Bee vs Violet">
      <Box className="flex-row flex-wrap gap-4">
        <BeeThemeScope appearance={appearance} brand="bee">
          <Card className="min-w-72 flex-1 gap-3" padding="lg" variant="raised">
            <Text variant="heading">Bee</Text>
            <CategoricalBarChart />
          </Card>
        </BeeThemeScope>
        <BeeThemeScope appearance={appearance} brand="violet">
          <Card className="min-w-72 flex-1 gap-3" padding="lg" variant="raised">
            <Text variant="heading">Violet</Text>
            <CategoricalBarChart />
          </Card>
        </BeeThemeScope>
      </Box>
    </ScenarioShell>
  );
}

// #68 — a scoped Brand A/B preview: Bee and Violet rendered side by side, each
// under its own `BeeThemeScope`, proving scoped brand selection visually with
// a couple of ordinary primitives (Button, Badge) rather than the chart
// vocabulary #78 already covers above.
function ScopedPreviewFixture({ theme }: { theme: VisualTheme }) {
  const appearance = appearanceForVisualTheme(theme);

  return (
    <ScenarioShell title="Scoped preview: Bee vs Violet">
      <Box className="flex-row flex-wrap gap-4">
        <BeeThemeScope appearance={appearance} brand="bee">
          <Card className="min-w-64 flex-1 gap-3" padding="lg" variant="raised">
            <Text variant="heading">Bee</Text>
            <Text tone="muted" variant="caption">
              brand=&quot;bee&quot;
            </Text>
            <Button onPress={() => undefined} size="md">
              Primary action
            </Button>
            <Badge variant="secondary">Badge</Badge>
          </Card>
        </BeeThemeScope>
        <BeeThemeScope appearance={appearance} brand="violet">
          <Card className="min-w-64 flex-1 gap-3" padding="lg" variant="raised">
            <Text variant="heading">Violet</Text>
            <Text tone="muted" variant="caption">
              brand=&quot;violet&quot;
            </Text>
            <Button onPress={() => undefined} size="md">
              Primary action
            </Button>
            <Badge variant="secondary">Badge</Badge>
          </Card>
        </BeeThemeScope>
      </Box>
    </ScenarioShell>
  );
}

// #77 finalization — active keyboard-focus proof for the high-contrast
// themes. A Button on the plain background, an Input inside a raised Card, and
// a Link on a muted surface — one representative placement per surface, tabbed
// through and captured mid-focus by `tests/high-contrast-focus.spec.ts` (a
// static page-load screenshot never exercises `:focus-visible`, so this
// fixture only supplies the DOM; the actual Tab-driven interaction lives in
// the spec).
function HighContrastFocusFixture() {
  return (
    <Box className="min-h-screen gap-6 bg-surface p-6" testID="high-contrast-focus-fixture">
      <Box className="gap-1">
        <Text variant="title">High-contrast keyboard focus</Text>
        <Text tone="muted" variant="caption">
          BeeUI issue #77 — actively Tab-triggered focus-visible proof
        </Text>
      </Box>

      <Box className="gap-2" testID="focus-target-background">
        <Text tone="muted" variant="caption">
          On background
        </Text>
        <Button onPress={() => undefined} testID="focus-target-button">
          Continue
        </Button>
      </Box>

      <Card className="gap-2" padding="lg" testID="focus-target-card" variant="raised">
        <Text tone="muted" variant="caption">
          On card
        </Text>
        <Input defaultValue="visual@beeui.dev" testID="focus-target-input" />
      </Card>

      <Box className="gap-2 rounded-md bg-surface-muted p-4" testID="focus-target-muted">
        <Text tone="muted" variant="caption">
          On muted surface
        </Text>
        <Link onPress={() => undefined} testID="focus-target-link">
          Learn more
        </Link>
      </Box>
    </Box>
  );
}

/**
 * Browser-only hardening fixture for the exact registration-order regression:
 * Dialog + nested menu commit first. Only after that commit (passive effect) does
 * the root Popover open, so the root overlay is guaranteed to register later.
 */
function CaseCHardeningFixture() {
  const [menuOpen, setMenuOpen] = React.useState(true);
  const [rootOpen, setRootOpen] = React.useState(false);

  React.useEffect(() => {
    if (menuOpen && !rootOpen) setRootOpen(true);
  }, [menuOpen, rootOpen]);

  return (
    <Box className="min-h-screen bg-surface p-6" testID="hardening-case-c">
      <Popover onOpenChange={setRootOpen} open={rootOpen}>
        <PopoverTrigger testID="hardening-casec-root-trigger">Root overlay</PopoverTrigger>
        <PopoverContent avoidSafeArea={false} testID="hardening-casec-root-content">
          <Text testID="hardening-casec-root-value">root-opened-after-menu</Text>
        </PopoverContent>
      </Popover>

      <Dialog open onOpenChange={() => undefined}>
        <DialogContent>
          <DialogTitle testID="hardening-casec-dialog-title">CASE C Dialog</DialogTitle>
          <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
            <DropdownMenuTrigger testID="hardening-casec-menu-trigger">Menu</DropdownMenuTrigger>
            <DropdownMenuContent testID="hardening-casec-menu-content">
              <DropdownMenuItem testID="hardening-casec-menu-item">Item</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

/**
 * Non-screenshot geometry fixture: proves tabular numerals render equal-width
 * figures (so numeric columns align) and that the mono family resolves, without
 * committing a platform-specific PNG baseline. Driven by `data-typography.spec.ts`.
 */
function DataTypographyFixture() {
  const alignedValues = ['111.11', '888.88', '909.90', '123.45'];
  return (
    <Box className="min-h-screen gap-6 bg-surface p-6" testID="data-typography-fixture">
      <Text variant="title">Data typography</Text>
      {/* Tabular column: proves the font-variant-numeric mechanism is wired. Absolute
          equal-width rendering depends on the active web font supporting tnum. */}
      <Box className="w-40 gap-1" testID="tabular-column">
        {alignedValues.map((value) => (
          <Text
            className="text-right"
            key={`tabular-${value}`}
            numeric="tabular"
            testID={`tabular-${value}`}
            variant="body"
          >
            {value}
          </Text>
        ))}
      </Box>
      {/* Mono column: the system-monospace family is guaranteed equal-width on every
          platform, so same-length values align — a font-independent geometry proof. */}
      <Box className="gap-1" testID="mono-column">
        {alignedValues.map((value) => (
          <Text family="mono" key={`mono-${value}`} testID={`mono-num-${value}`} variant="body">
            {value}
          </Text>
        ))}
      </Box>
      <Text family="mono" testID="mono-code" variant="body">
        BEE-2026-08-22-0202
      </Text>
    </Box>
  );
}

// #152 — real-browser evidence for the Tooltip Web contract
// (`docs/decisions/005-tooltip-contract.md`): pointer hover with a default
// 500ms open delay, keyboard focus with no delay, a fast-delay instance so
// timing assertions do not need arbitrary long waits, and a controlled
// instance proving `open`/`onOpenChange` plumb through unchanged.
function TooltipFixture() {
  const [controlledOpen, setControlledOpen] = React.useState(false);

  return (
    <Box className="min-h-screen gap-6 bg-surface p-6" testID="tooltip-fixture">
      <Box className="gap-1">
        <Text variant="title">Tooltip</Text>
        <Text tone="muted" variant="caption">
          BeeUI issue #152 — Web hover/focus/Escape behavior
        </Text>
      </Box>

      <Card className="min-h-32 items-start justify-center gap-3" padding="lg" variant="raised">
        <Text variant="heading">Default (500ms open / 300ms close)</Text>
        <Tooltip>
          <TooltipTrigger testID="tooltip-default-trigger" variant="outline">
            Hover or focus me
          </TooltipTrigger>
          <TooltipContent testID="tooltip-default-content">
            Saved automatically every 30 seconds
          </TooltipContent>
        </Tooltip>
      </Card>

      <Card className="min-h-32 items-start justify-center gap-3" padding="lg" variant="outlined">
        <Text variant="heading">Fast delays (quick enter/leave evidence)</Text>
        <Tooltip closeDelay={60} openDelay={300}>
          <TooltipTrigger testID="tooltip-fast-trigger" variant="outline">
            Hover me (300ms)
          </TooltipTrigger>
          <TooltipContent testID="tooltip-fast-content">Fast tooltip</TooltipContent>
        </Tooltip>
      </Card>

      <Card className="min-h-32 items-start justify-center gap-3" padding="lg" variant="raised">
        <Text variant="heading">Controlled</Text>
        <Tooltip onOpenChange={setControlledOpen} open={controlledOpen}>
          <TooltipTrigger
            onPress={() => setControlledOpen((value) => !value)}
            testID="tooltip-controlled-trigger"
            variant="outline"
          >
            Toggle via press
          </TooltipTrigger>
          <TooltipContent testID="tooltip-controlled-content">Controlled open state</TooltipContent>
        </Tooltip>
        <Text testID="tooltip-controlled-state" tone="muted" variant="caption">
          {`open: ${controlledOpen}`}
        </Text>
      </Card>
    </Box>
  );
}

function Scenario({ scenario }: { scenario: VisualScenarioId }) {
  switch (scenario) {
    case 'foundation':
      return <FoundationScenario />;
    case 'forms':
      return <FormsScenario />;
    case 'navigation-data':
      return <NavigationDataScenario />;
    case 'dialog-open':
      return <DialogOpenScenario />;
    case 'alert-dialog-open':
      return <AlertDialogOpenScenario />;
    case 'popover-open':
      return <PopoverOpenScenario />;
    case 'dropdown-menu-open':
      return <DropdownMenuOpenScenario />;
    case 'pattern-sign-in':
      return <PatternSignInScenario />;
    case 'dataviz':
      return <DataVizScenario />;
  }
}

export default function App() {
  const [{ scenario, theme }] = React.useState(readVisualQuery);
  const [hardening] = React.useState(readHardeningQuery);
  const [dataTypography] = React.useState(readDataTypographyQuery);
  const [fixture] = React.useState(readFixtureQuery);
  const [densityMode] = React.useState(readDensityModeQuery);
  useVisualReadiness(scenario, theme);

  return (
    <BeeUIProvider>
      {hardening === 'case-c' ? (
        <CaseCHardeningFixture />
      ) : dataTypography ? (
        <DataTypographyFixture />
      ) : fixture === 'density' ? (
        <DensityFixture density={densityMode} theme={theme} />
      ) : fixture === 'dataviz-brands' ? (
        <DataVizBrandsFixture theme={theme} />
      ) : fixture === 'scoped-preview' ? (
        <ScopedPreviewFixture theme={theme} />
      ) : fixture === 'high-contrast-focus' ? (
        <HighContrastFocusFixture />
      ) : fixture === 'tooltip' ? (
        <TooltipFixture />
      ) : (
        <Scenario scenario={scenario} />
      )}
    </BeeUIProvider>
  );
}
