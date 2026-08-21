import './global.css';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertBanner,
  AppHeader,
  Avatar,
  Badge,
  BottomActionBar,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DescriptionItem,
  DescriptionList,
  EmptyState,
  ErrorState,
  Field,
  HStack,
  IconButton,
  Input,
  Link,
  ListGroup,
  ListGroupHeader,
  ListItem,
  OTPInput,
  Pagination,
  PaginationItem,
  PasswordInput,
  Progress,
  Radio,
  RadioGroup,
  Screen,
  SearchInput,
  Section,
  SegmentedControl,
  SegmentedControlItem,
  Separator,
  SettingsItem,
  Skeleton,
  Spinner,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatValue,
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
  VStack,
} from '@beeui/ui';
import * as React from 'react';
import { ScrollView, StatusBar } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';

function ThemeToggle() {
  const { hasAdaptiveThemes, theme } = useUniwind();
  const activeTheme = hasAdaptiveThemes ? 'system' : theme;
  const cycleTheme = () => {
    if (activeTheme === 'system') return Uniwind.setTheme('light');
    if (activeTheme === 'light') return Uniwind.setTheme('dark');
    Uniwind.setTheme('system');
  };
  return <Button onPress={cycleTheme} size="sm" variant="outline">{`Theme: ${activeTheme}`}</Button>;
}

export default function App() {
  const { theme } = useUniwind();
  const [accepted, setAccepted] = React.useState(false);
  const [notifications, setNotifications] = React.useState(true);
  const [plan, setPlan] = React.useState<'starter' | 'pro'>('starter');
  const [tab, setTab] = React.useState('overview');
  const [otp, setOtp] = React.useState('');
  const [filters, setFilters] = React.useState<string[]>(['mobile']);
  const [viewMode, setViewMode] = React.useState('list');
  const [page, setPage] = React.useState(2);
  const [step, setStep] = React.useState(2);

  return (
    <Screen>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <AppHeader
        description="React Native + TypeScript components built on semantic tokens."
        leading={<Avatar accessibilityLabel="BeeUI" fallback="BU" />}
        title="BeeUI"
        trailing={<ThemeToggle />}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <Box className="mx-auto w-full max-w-2xl gap-8 px-5 py-8">
          <AlertBanner
            description="This showcase is bundled for web, Android, and iOS in CI."
            title="Portable foundation"
            variant="info"
          />

          <Card className="gap-4" variant="raised">
            <Section
              action={<IconButton accessibilityLabel="Add item" variant="outline">＋</IconButton>}
              description="Variants, disabled and loading behavior."
              title="Buttons"
            >
              <Box className="gap-3">
                <Button>Primary action</Button>
                <Button variant="secondary">Secondary action</Button>
                <Button variant="outline">Outline action</Button>
                <Button variant="ghost">Ghost action</Button>
                <Button variant="destructive">Destructive action</Button>
                <Button disabled>Disabled action</Button>
                <Button loading>Loading action</Button>
              </Box>
            </Section>
          </Card>

          <Card className="gap-4">
            <Text variant="heading">Form primitives</Text>
            <Field description="Used only for account notifications." label="Email" required>
              <Input autoCapitalize="none" placeholder="you@example.com" />
            </Field>
            <Field label="Search"><SearchInput onSearch={() => undefined} placeholder="Search projects" /></Field>
            <Field label="Password"><PasswordInput placeholder="Enter password" /></Field>
            <Field description="Six numeric digits." label="Verification code"><OTPInput accessibilityLabel="Verification code" onValueChange={setOtp} value={otp} /></Field>
            <Field error="Enter a valid project name." invalid label="Project name"><Input placeholder="Invalid value" /></Field>
            <Field disabled label="Managed field"><Input placeholder="Disabled by field context" /></Field>
            <Field description="Optional long-form content." label="Notes"><Textarea placeholder="Long-form notes" /></Field>
            <Separator />
            <Checkbox checked={accepted} label="Accept terms" onCheckedChange={setAccepted} />
            <RadioGroup accessibilityLabel="Subscription plan" onValueChange={(value) => setPlan(value as 'starter' | 'pro')} value={plan}>
              <Radio label="Starter plan" value="starter" /><Radio label="Pro plan" value="pro" />
            </RadioGroup>
            <Box className="flex-row items-center justify-between gap-4"><Text>Notifications</Text><Switch accessibilityLabel="Notifications" onValueChange={setNotifications} value={notifications} /></Box>
          </Card>

          <Card className="gap-4">
            <Section description="Dependency-free filters, view selection and paging." title="Selection and navigation">
              <Text variant="label">Filters</Text>
              <ChipGroup
                onValueChange={(value) => setFilters(Array.isArray(value) ? value : [value])}
                selectionMode="multiple"
                value={filters}
              >
                <Chip value="mobile">Mobile</Chip>
                <Chip value="web">Web</Chip>
                <Chip value="design">Design</Chip>
              </ChipGroup>
              <Text variant="label">View</Text>
              <SegmentedControl onValueChange={setViewMode} value={viewMode}>
                <SegmentedControlItem value="list">List</SegmentedControlItem>
                <SegmentedControlItem value="grid">Grid</SegmentedControlItem>
              </SegmentedControl>
              <Text variant="label">Page</Text>
              <Pagination onPageChange={setPage} page={page} pageCount={4}>
                <PaginationItem type="previous" />
                <PaginationItem page={1} />
                <PaginationItem page={2} />
                <PaginationItem page={3} />
                <PaginationItem page={4} />
                <PaginationItem type="next" />
              </Pagination>
            </Section>
          </Card>

          <Card className="gap-5">
            <Section description="Layout, history and application composition without router ownership." title="Application composition">
              <Breadcrumb accessibilityLabel="Project breadcrumb">
                <BreadcrumbItem onPress={() => undefined}>Projects</BreadcrumbItem>
                <BreadcrumbItem current>BeeUI</BreadcrumbItem>
              </Breadcrumb>

              <Stack gap="lg">
                <HStack gap="lg" wrap>
                  <Stat className="min-w-32 flex-1">
                    <StatLabel>Exports</StatLabel>
                    <StatValue>78</StatValue>
                    <StatHelpText>Foundation primitives</StatHelpText>
                  </Stat>
                  <Stat className="min-w-32 flex-1">
                    <StatLabel>Contract tests</StatLabel>
                    <StatValue>41</StatValue>
                    <StatHelpText>Before native gates</StatHelpText>
                  </Stat>
                </HStack>

                <Stepper currentStep={step} onStepChange={setStep}>
                  <StepperItem step={1} title="Foundation" />
                  <StepperItem step={2} title="Application patterns" />
                  <StepperItem step={3} title="Overlays" />
                </Stepper>

                <ListGroup>
                  <ListGroupHeader description="Composition reuses existing row behavior." title="Workspace" />
                  <ListItem description="Portable component system" onPress={() => undefined} title="BeeUI" />
                </ListGroup>

                <Timeline>
                  <TimelineItem description="Core layout and form contracts established." meta="v0.1" status="success" title="Foundation" />
                  <TimelineItem description="Bare RN and Android native build verified." meta="CI verified" status="success" title="Native portability" />
                  <TimelineItem description="Accessibility and read-only patterns in progress." meta="Current" status="primary" title="Application layer" />
                </Timeline>

                <VStack gap="xs">
                  <Text tone="muted" variant="caption">Navigation remains application-owned.</Text>
                  <Link onPress={() => undefined}>Open documentation</Link>
                </VStack>
              </Stack>
            </Section>
          </Card>

          <Card className="gap-4">
            <Section description="Read-only application information patterns." title="Metadata">
              <DescriptionList>
                <DescriptionItem label="Runtime" value="React Native 0.86.2" />
                <DescriptionItem label="Styling" value="Uniwind 1.10.1" />
                <DescriptionItem description="Generated and compiled in CI" label="Native verification" value="Android + iOS Metro" />
              </DescriptionList>
            </Section>
          </Card>

          <Card className="gap-4">
            <Text variant="heading">Disclosure</Text>
            <Collapsible><CollapsibleTrigger>Advanced options</CollapsibleTrigger><CollapsibleContent><Text tone="muted">Hidden until expanded.</Text></CollapsibleContent></Collapsible>
            <Accordion defaultValue="account">
              <AccordionItem value="account"><AccordionTrigger>Account</AccordionTrigger><AccordionContent><Text tone="muted">Account preferences and identity.</Text></AccordionContent></AccordionItem>
              <AccordionItem value="billing"><AccordionTrigger>Billing</AccordionTrigger><AccordionContent><Text tone="muted">Invoices and payment settings.</Text></AccordionContent></AccordionItem>
            </Accordion>
          </Card>

          <Card className="gap-4">
            <Text variant="heading">Application rows</Text>
            <ListItem description="Open your profile" onPress={() => undefined} title="Profile" trailing={<Badge variant="success">Active</Badge>} />
            <SettingsItem description="Changes app appearance" onPress={() => undefined} title="Appearance" value={theme} />
            <SettingsItem description="Native preference control" title="Push notifications" trailing={<Switch accessibilityLabel="Push notifications" onValueChange={setNotifications} value={notifications} />} />
          </Card>

          <Card className="gap-4">
            <Text variant="heading">Tabs</Text>
            <Tabs onValueChange={setTab} value={tab}><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="details">Details</TabsTrigger></TabsList><TabsContent value="overview"><Text tone="muted">Overview content is mounted for the active tab.</Text></TabsContent><TabsContent value="details"><Text tone="muted">Details content is mounted only when selected.</Text></TabsContent></Tabs>
          </Card>

          <Card className="gap-4" variant="muted">
            <Text variant="heading">Status and feedback</Text>
            <Box className="flex-row flex-wrap gap-2"><Badge>Primary</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="success">Success</Badge><Badge variant="warning">Warning</Badge><Badge variant="destructive">Error</Badge><Badge variant="info">Info</Badge></Box>
            <Separator />
            <Box className="flex-row items-center gap-5"><Spinner /><Spinner tone="success" /><Spinner tone="warning" /><Spinner tone="destructive" /></Box>
            <Progress accessibilityLabel="Profile completion" value={72} />
          </Card>

          <Card className="gap-4"><Text variant="heading">State compositions</Text><EmptyState description="Create your first record to get started." title="No records yet" action={<Button size="sm">Create record</Button>} /><Separator /><ErrorState description="The server could not load this section." action={<Button size="sm" variant="outline">Try again</Button>} /></Card>

          <Card className="gap-4"><Text variant="heading">Loading surfaces</Text><Box className="flex-row items-center gap-3"><Skeleton className="h-12 w-12" variant="circle" /><Box className="flex-1 gap-2"><Skeleton className="w-2/3" variant="text" /><Skeleton className="w-full" variant="text" /></Box></Box><Skeleton className="h-24 w-full" /></Card>
        </Box>
      </ScrollView>
      <BottomActionBar><Button size="sm" variant="ghost">Cancel</Button><Button size="sm">Save changes</Button></BottomActionBar>
    </Screen>
  );
}
