import './global.css';

import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Input,
  Separator,
  Spinner,
  Switch,
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
    if (activeTheme === 'system') {
      Uniwind.setTheme('light');
      return;
    }

    if (activeTheme === 'light') {
      Uniwind.setTheme('dark');
      return;
    }

    Uniwind.setTheme('system');
  };

  return (
    <Button onPress={cycleTheme} size="sm" variant="outline">
      {`Theme: ${activeTheme}`}
    </Button>
  );
}

export default function App() {
  const { theme } = useUniwind();
  const [accepted, setAccepted] = React.useState(false);
  const [notifications, setNotifications] = React.useState(true);

  return (
    <Box className="flex-1 bg-background">
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Box className="mx-auto w-full max-w-2xl gap-8 px-5 pb-10 pt-16">
          <Box className="gap-3">
            <Box className="flex-row items-center justify-between gap-4">
              <Text variant="title">BeeUI</Text>
              <ThemeToggle />
            </Box>
            <Text tone="muted">
              React Native + TypeScript components built on semantic tokens. Uniwind is an
              implementation detail, not part of the component API.
            </Text>
          </Box>

          <Card className="gap-4" variant="raised">
            <Text variant="heading">Buttons</Text>
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
            <Input autoCapitalize="none" placeholder="Email address" />
            <Input invalid placeholder="Invalid value" />
            <Input disabled placeholder="Disabled input" />
            <Textarea placeholder="Long-form notes" />
            <Separator />
            <Checkbox
              checked={accepted}
              label="Accept terms"
              onCheckedChange={setAccepted}
            />
            <Checkbox checked="indeterminate" label="Partially selected" />
            <Box className="flex-row items-center justify-between gap-4">
              <Text>Notifications</Text>
              <Switch
                accessibilityLabel="Notifications"
                onValueChange={setNotifications}
                value={notifications}
              />
            </Box>
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
              <Badge variant="outline">Outline</Badge>
            </Box>
            <Separator />
            <Box className="flex-row items-center gap-5">
              <Spinner />
              <Spinner tone="success" />
              <Spinner tone="warning" />
              <Spinner tone="destructive" />
              <Spinner tone="info" />
            </Box>
          </Card>

          <Card className="gap-3" variant="muted">
            <Text variant="heading">Semantic typography</Text>
            <Text>Default body text follows the foreground token.</Text>
            <Text tone="muted">Muted content remains readable in light and dark themes.</Text>
            <Text tone="success" variant="label">
              Success state
            </Text>
            <Text tone="warning" variant="label">
              Warning state
            </Text>
            <Text tone="info" variant="label">
              Information state
            </Text>
            <Text tone="destructive" variant="label">
              Destructive state
            </Text>
          </Card>
        </Box>
      </ScrollView>
    </Box>
  );
}
