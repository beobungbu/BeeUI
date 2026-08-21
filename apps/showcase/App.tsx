import './global.css';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  ListItem,
  Progress,
  Radio,
  RadioGroup,
  Separator,
  SettingsItem,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Textarea,
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

  return (
    <Box className="flex-1 bg-background">
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Box className="mx-auto w-full max-w-2xl gap-8 px-5 pb-10 pt-16">
          <Box className="gap-3">
            <Box className="flex-row items-center justify-between gap-4">
              <Box className="flex-row items-center gap-3">
                <Avatar accessibilityLabel="BeeUI" fallback="BU" />
                <Text variant="title">BeeUI</Text>
              </Box>
              <ThemeToggle />
            </Box>
            <Text tone="muted">React Native + TypeScript components built on semantic tokens.</Text>
          </Box>

          <Card className="gap-4" variant="raised">
            <Box className="flex-row items-center justify-between">
              <Text variant="heading">Buttons</Text>
              <IconButton accessibilityLabel="Add item" variant="outline">＋</IconButton>
            </Box>
            <Box className="gap-3">
              <Button>Primary action</Button>
              <Button variant="secondary">Secondary action</Button>
              <Button variant="outline">Outline action</Button>
              <Button variant="ghost">Ghost action</Button>
              <Button variant="destructive">Destructive action</Button>
              <Button disabled>Disabled action</Button>
              <Button loading>Loading action</Button>
            </Box>
          </Card>

          <Card className="gap-4">
            <Text variant="heading">Form primitives</Text>
            <Field description="Used only for account notifications." label="Email" required>
              <Input autoCapitalize="none" placeholder="you@example.com" />
            </Field>
            <Field error="Enter a valid project name." invalid label="Project name"><Input placeholder="Invalid value" /></Field>
            <Field disabled label="Managed field"><Input placeholder="Disabled by field context" /></Field>
            <Field description="Optional long-form content." label="Notes"><Textarea placeholder="Long-form notes" /></Field>
            <Separator />
            <Checkbox checked={accepted} label="Accept terms" onCheckedChange={setAccepted} />
            <RadioGroup accessibilityLabel="Subscription plan" onValueChange={(value) => setPlan(value as 'starter' | 'pro')} value={plan}>
              <Radio label="Starter plan" value="starter" />
              <Radio label="Pro plan" value="pro" />
            </RadioGroup>
            <Box className="flex-row items-center justify-between gap-4">
              <Text>Notifications</Text>
              <Switch accessibilityLabel="Notifications" onValueChange={setNotifications} value={notifications} />
            </Box>
          </Card>

          <Card className="gap-4">
            <Text variant="heading">Disclosure</Text>
            <Collapsible>
              <CollapsibleTrigger>Advanced options</CollapsibleTrigger>
              <CollapsibleContent><Text tone="muted">Hidden until expanded.</Text></CollapsibleContent>
            </Collapsible>
            <Accordion defaultValue="account">
              <AccordionItem value="account">
                <AccordionTrigger>Account</AccordionTrigger>
                <AccordionContent><Text tone="muted">Account preferences and identity.</Text></AccordionContent>
              </AccordionItem>
              <AccordionItem value="billing">
                <AccordionTrigger>Billing</AccordionTrigger>
                <AccordionContent><Text tone="muted">Invoices and payment settings.</Text></AccordionContent>
              </AccordionItem>
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
            <Tabs onValueChange={setTab} value={tab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              <TabsContent value="overview"><Text tone="muted">Overview content is mounted for the active tab.</Text></TabsContent>
              <TabsContent value="details"><Text tone="muted">Details content is mounted only when selected.</Text></TabsContent>
            </Tabs>
          </Card>

          <Card className="gap-4" variant="muted">
            <Text variant="heading">Status and feedback</Text>
            <Box className="flex-row flex-wrap gap-2">
              <Badge>Primary</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="success">Success</Badge><Badge variant="warning">Warning</Badge><Badge variant="destructive">Error</Badge><Badge variant="info">Info</Badge>
            </Box>
            <Separator />
            <Box className="flex-row items-center gap-5"><Spinner /><Spinner tone="success" /><Spinner tone="warning" /><Spinner tone="destructive" /></Box>
            <Progress accessibilityLabel="Profile completion" value={72} />
          </Card>

          <Card className="gap-4">
            <Text variant="heading">State compositions</Text>
            <EmptyState description="Create your first record to get started." title="No records yet" action={<Button size="sm">Create record</Button>} />
            <Separator />
            <ErrorState description="The server could not load this section." action={<Button size="sm" variant="outline">Try again</Button>} />
          </Card>

          <Card className="gap-4">
            <Text variant="heading">Loading surfaces</Text>
            <Box className="flex-row items-center gap-3">
              <Skeleton className="h-12 w-12" variant="circle" />
              <Box className="flex-1 gap-2"><Skeleton className="w-2/3" variant="text" /><Skeleton className="w-full" variant="text" /></Box>
            </Box>
            <Skeleton className="h-24 w-full" />
          </Card>
        </Box>
      </ScrollView>
    </Box>
  );
}
