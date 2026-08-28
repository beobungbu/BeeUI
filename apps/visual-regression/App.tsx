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
  ListGroup,
  ListGroupHeader,
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
} from '@beeui/ui';
import * as React from 'react';
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
  }
}

export default function App() {
  const [{ scenario, theme }] = React.useState(readVisualQuery);
  const [hardening] = React.useState(readHardeningQuery);
  const [dataTypography] = React.useState(readDataTypographyQuery);
  useVisualReadiness(scenario, theme);

  return (
    <BeeUIProvider>
      {hardening === 'case-c' ? (
        <CaseCHardeningFixture />
      ) : dataTypography ? (
        <DataTypographyFixture />
      ) : (
        <Scenario scenario={scenario} />
      )}
    </BeeUIProvider>
  );
}
