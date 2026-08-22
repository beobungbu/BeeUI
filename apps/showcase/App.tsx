import './global.css';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertBanner,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  AppHeader,
  Avatar,
  Badge,
  BeeUIProvider,
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Field,
  FormGroup,
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
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  Progress,
  Radio,
  RadioGroup,
  SafeArea,
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

  return (
    <Button onPress={cycleTheme} size="sm" variant="outline">
      {`Theme: ${activeTheme}`}
    </Button>
  );
}

function PlaygroundHeading({ children, description }: { children: string; description: string }) {
  return (
    <VStack gap="xs">
      <Text variant="heading">{children}</Text>
      <Text tone="muted">{description}</Text>
    </VStack>
  );
}

function PlacementPopover({ placement }: { placement: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Popover>
      <PopoverTrigger size="sm" variant="outline">
        {placement}
      </PopoverTrigger>
      <PopoverContent placement={placement}>
        <PopoverTitle>{`${placement[0].toUpperCase()}${placement.slice(1)} placement`}</PopoverTitle>
        <PopoverDescription>
          This surface is positioned by the shared anchored-overlay geometry kernel.
        </PopoverDescription>
        <PopoverClose size="sm" variant="ghost">
          Close
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
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
  const [step, setStep] = React.useState(3);

  return (
    <BeeUIProvider>
      <Screen>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
          <AppHeader
            description="Interactive React Native component playground · 95 public components/subcomponents · 106 contract tests"
            leading={<Avatar accessibilityLabel="BeeUI" fallback="BU" />}
            title="BeeUI Showcase v2"
            trailing={<ThemeToggle />}
          />
        </SafeArea>

        <SafeArea className="flex-1" edges={['left', 'right']}>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            <Box className="mx-auto w-full max-w-3xl gap-10 px-5 py-8">
              <AlertBanner
                description="Everything below is rendered from the public @beeui/ui API. Switch themes, open overlays, change form state, and resize the web window to exercise the same contracts used on native."
                title="Hands-on playground"
                variant="info"
              />

              <PlaygroundHeading description="Buttons, semantic surfaces, feedback, and loading states.">
                Foundation
              </PlaygroundHeading>

              <Card className="gap-4" variant="raised">
                <Section
                  action={<IconButton accessibilityLabel="Add item" variant="outline">＋</IconButton>}
                  description="Variants, disabled state, and loading behavior."
                  title="Actions"
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

              <Card className="gap-4" variant="muted">
                <Text variant="heading">Status and feedback</Text>
                <Box className="flex-row flex-wrap gap-2">
                  <Badge>Primary</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="destructive">Error</Badge>
                  <Badge variant="info">Info</Badge>
                </Box>
                <Separator />
                <Box className="flex-row items-center gap-5">
                  <Spinner />
                  <Spinner tone="success" />
                  <Spinner tone="warning" />
                  <Spinner tone="destructive" />
                </Box>
                <Progress accessibilityLabel="Profile completion" value={72} />
              </Card>

              <Card className="gap-4">
                <Text variant="heading">Loading and state surfaces</Text>
                <Box className="flex-row items-center gap-3">
                  <Skeleton className="h-12 w-12" variant="circle" />
                  <Box className="flex-1 gap-2">
                    <Skeleton className="w-2/3" variant="text" />
                    <Skeleton className="w-full" variant="text" />
                  </Box>
                </Box>
                <Skeleton className="h-24 w-full" />
                <Separator />
                <EmptyState
                  action={<Button size="sm">Create record</Button>}
                  description="Create your first record to get started."
                  title="No records yet"
                />
                <Separator />
                <ErrorState
                  action={<Button size="sm" variant="outline">Try again</Button>}
                  description="The server could not load this section."
                />
              </Card>

              <PlaygroundHeading description="Text-entry composition plus explicit group semantics for related choices.">
                Forms
              </PlaygroundHeading>

              <Card className="gap-4">
                <Field description="Used only for account notifications." label="Email" required>
                  <Input autoCapitalize="none" placeholder="you@example.com" />
                </Field>
                <Field label="Search">
                  <SearchInput onSearch={() => undefined} placeholder="Search projects" />
                </Field>
                <Field label="Password">
                  <PasswordInput placeholder="Enter password" />
                </Field>
                <Field description="Six numeric digits." label="Verification code">
                  <OTPInput
                    accessibilityLabel="Verification code"
                    onValueChange={setOtp}
                    value={otp}
                  />
                </Field>
                <Field error="Enter a valid project name." invalid label="Project name">
                  <Input placeholder="Invalid value" />
                </Field>
                <Field disabled label="Managed field">
                  <Input placeholder="Disabled by field context" />
                </Field>
                <Field description="Optional long-form content." label="Notes">
                  <Textarea placeholder="Long-form notes" />
                </Field>
                <Separator />
                <Checkbox checked={accepted} label="Accept terms" onCheckedChange={setAccepted} />
                <FormGroup
                  description="The group owns legend/guidance metadata while each radio stays independently discoverable."
                  legend="Subscription plan"
                  required
                >
                  <RadioGroup
                    onValueChange={(value) => setPlan(value as 'starter' | 'pro')}
                    value={plan}
                  >
                    <Radio label="Starter plan" value="starter" />
                    <Radio label="Pro plan" value="pro" />
                  </RadioGroup>
                </FormGroup>
                <Box className="flex-row items-center justify-between gap-4">
                  <Text>Notifications</Text>
                  <Switch
                    accessibilityLabel="Notifications"
                    onValueChange={setNotifications}
                    value={notifications}
                  />
                </Box>
              </Card>

              <PlaygroundHeading description="Modal and anchored overlays now have real public APIs you can click through here.">
                Overlay playground
              </PlaygroundHeading>

              <Card className="gap-5" variant="raised">
                <Section
                  description="Centered modal-class overlays use React Native core Modal."
                  title="Dialog and AlertDialog"
                >
                  <HStack gap="sm" wrap>
                    <Dialog>
                      <DialogTrigger>Open Dialog</DialogTrigger>
                      <DialogContent>
                        <DialogTitle>Project settings</DialogTitle>
                        <DialogDescription>
                          This is BeeUI's centered modal surface. Backdrop, accessibility escape, and native request-close follow the Dialog contract.
                        </DialogDescription>
                        <Field label="Project name">
                          <Input defaultValue="BeeUI" />
                        </Field>
                        <DialogFooter>
                          <DialogClose variant="outline">Cancel</DialogClose>
                          <DialogClose>Save changes</DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger variant="destructive">Delete project</AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The backdrop cannot dismiss this confirmation. Choose an explicit action instead.
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction>Delete permanently</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </HStack>
                </Section>

                <Separator />

                <Section
                  description="Popover uses the shared non-Modal host, window-coordinate measurement, collision handling, and topmost dismissal stack."
                  title="Popover placements"
                >
                  <HStack gap="sm" wrap>
                    <PlacementPopover placement="top" />
                    <PlacementPopover placement="right" />
                    <PlacementPopover placement="bottom" />
                    <PlacementPopover placement="left" />
                  </HStack>
                </Section>

                <Separator />

                <Section
                  description="Open the parent, then the child. Outside press / Escape / accessibility escape dismisses child-first."
                  title="Nested Popover"
                >
                  <Popover>
                    <PopoverTrigger variant="secondary">Open parent</PopoverTrigger>
                    <PopoverContent align="start" placement="bottom">
                      <PopoverTitle>Parent Popover</PopoverTitle>
                      <PopoverDescription>
                        The child registers above this overlay in the shared dismiss stack.
                      </PopoverDescription>
                      <Popover>
                        <PopoverTrigger size="sm" variant="outline">Open child</PopoverTrigger>
                        <PopoverContent align="start" placement="right">
                          <PopoverTitle>Child Popover</PopoverTitle>
                          <PopoverDescription>
                            Dismiss me first; the parent remains mounted underneath.
                          </PopoverDescription>
                          <PopoverClose size="sm">Done</PopoverClose>
                        </PopoverContent>
                      </Popover>
                    </PopoverContent>
                  </Popover>
                </Section>

                <Separator />

                <Section
                  description="This trigger is aligned to the container edge. Shrink the web viewport or rotate a device to make flip/shift collision handling obvious."
                  title="Collision edge case"
                >
                  <Box className="items-end">
                    <Popover>
                      <PopoverTrigger variant="outline">Near right edge</PopoverTrigger>
                      <PopoverContent align="start" placement="right" sideOffset={12}>
                        <PopoverTitle>Collision-aware placement</PopoverTitle>
                        <PopoverDescription>
                          Preferred placement is right; the resolver flips or shifts only when the viewport requires it.
                        </PopoverDescription>
                        <PopoverClose size="sm" variant="ghost">Close</PopoverClose>
                      </PopoverContent>
                    </Popover>
                  </Box>
                </Section>
              </Card>

              <PlaygroundHeading description="Selections, tabs, disclosure, paging, and application-level composition stay router-neutral.">
                Navigation and composition
              </PlaygroundHeading>

              <Card className="gap-4">
                <Section description="Dependency-free filters, view selection, and paging." title="Selection and navigation">
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

              <Card className="gap-4">
                <Text variant="heading">Tabs and disclosure</Text>
                <Tabs onValueChange={setTab} value={tab}>
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview">
                    <Text tone="muted">Overview content is mounted for the active tab.</Text>
                  </TabsContent>
                  <TabsContent value="details">
                    <Text tone="muted">Details content is mounted only when selected.</Text>
                  </TabsContent>
                </Tabs>
                <Separator />
                <Collapsible>
                  <CollapsibleTrigger>Advanced options</CollapsibleTrigger>
                  <CollapsibleContent>
                    <Text tone="muted">Hidden until expanded.</Text>
                  </CollapsibleContent>
                </Collapsible>
                <Accordion defaultValue="account">
                  <AccordionItem value="account">
                    <AccordionTrigger>Account</AccordionTrigger>
                    <AccordionContent>
                      <Text tone="muted">Account preferences and identity.</Text>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="billing">
                    <AccordionTrigger>Billing</AccordionTrigger>
                    <AccordionContent>
                      <Text tone="muted">Invoices and payment settings.</Text>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>

              <Card className="gap-5">
                <Section
                  description="Layout, history, and application composition without router ownership."
                  title="Application composition"
                >
                  <Breadcrumb accessibilityLabel="Project breadcrumb">
                    <BreadcrumbItem onPress={() => undefined}>Projects</BreadcrumbItem>
                    <BreadcrumbItem current>BeeUI</BreadcrumbItem>
                  </Breadcrumb>

                  <Stack gap="lg">
                    <HStack gap="lg" wrap>
                      <Stat className="min-w-32 flex-1">
                        <StatLabel>Public pieces</StatLabel>
                        <StatValue>95</StatValue>
                        <StatHelpText>Components + subcomponents</StatHelpText>
                      </Stat>
                      <Stat className="min-w-32 flex-1">
                        <StatLabel>Contract tests</StatLabel>
                        <StatValue>106</StatValue>
                        <StatHelpText>13 test suites</StatHelpText>
                      </Stat>
                    </HStack>

                    <Stepper currentStep={step} onStepChange={setStep}>
                      <StepperItem step={1} title="Foundation" />
                      <StepperItem step={2} title="Application patterns" />
                      <StepperItem step={3} title="Overlays" />
                    </Stepper>

                    <ListGroup>
                      <ListGroupHeader
                        description="Composition reuses existing row behavior."
                        title="Workspace"
                      />
                      <ListItem
                        description="Portable component system"
                        onPress={() => undefined}
                        title="BeeUI"
                      />
                    </ListGroup>

                    <Timeline>
                      <TimelineItem
                        description="Core layout, form, navigation, and modal contracts established."
                        meta="v0.1"
                        status="success"
                        title="Foundation"
                      />
                      <TimelineItem
                        description="Packed packages bundle in Expo and bare React Native; Android APK compiles in CI."
                        meta="CI verified"
                        status="success"
                        title="Native portability"
                      />
                      <TimelineItem
                        description="Public Popover now exercises the anchored overlay geometry/runtime kernels."
                        meta="Current"
                        status="primary"
                        title="Anchored overlays"
                      />
                    </Timeline>
                  </Stack>
                </Section>
              </Card>

              <Card className="gap-4">
                <Section description="Read-only application information patterns." title="Metadata and rows">
                  <DescriptionList>
                    <DescriptionItem label="Runtime" value="React Native 0.86.2" />
                    <DescriptionItem label="Styling" value="Uniwind 1.10.1" />
                    <DescriptionItem
                      description="Generated and compiled in CI"
                      label="Native verification"
                      value="Expo + bare RN"
                    />
                  </DescriptionList>
                  <Separator />
                  <ListItem
                    description="Open your profile"
                    onPress={() => undefined}
                    title="Profile"
                    trailing={<Badge variant="success">Active</Badge>}
                  />
                  <SettingsItem
                    description="Changes app appearance"
                    onPress={() => undefined}
                    title="Appearance"
                    value={theme}
                  />
                  <SettingsItem
                    description="Native preference control"
                    title="Push notifications"
                    trailing={
                      <Switch
                        accessibilityLabel="Push notifications"
                        onValueChange={setNotifications}
                        value={notifications}
                      />
                    }
                  />
                </Section>
              </Card>

              <VStack gap="xs">
                <Text tone="muted" variant="caption">
                  Navigation remains application-owned. This showcase intentionally has no router or docs-site framework.
                </Text>
                <Link onPress={() => undefined}>Open documentation</Link>
              </VStack>
            </Box>
          </ScrollView>
        </SafeArea>

        <SafeArea className="bg-surface" edges={['bottom', 'left', 'right']}>
          <BottomActionBar>
            <Button size="sm" variant="ghost">Cancel</Button>
            <Button size="sm">Save changes</Button>
          </BottomActionBar>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
