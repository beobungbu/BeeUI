import './global.css';

import {
  BeeUIProvider,
  Button,
  Calendar,
  Card,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Input,
  SafeArea,
  Screen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
  type CalendarDate,
} from '@beeui/ui';
import * as React from 'react';
import { ScrollView, useColorScheme, useWindowDimensions } from 'react-native';

/**
 * R10.1 (#230) — minimal Expo SDK 57 package-consumption starter.
 *
 * Exercises the surfaces #230's DoD enumerates: BeeUIProvider/SafeArea,
 * light/dark theme (via the OS color scheme + BeeUI's semantic tokens —
 * high contrast is a device accessibility setting BeeUI's tokens already
 * respond to, not toggled here), form/validation composition
 * (Input/Checkbox), Dialog/Select/Tooltip, Sheet, Table, Calendar, Toast,
 * and a responsive layout hook (`useWindowDimensions`).
 */
function ToastDemo() {
  const toast = useToast();
  return (
    <Button
      onPress={() =>
        toast.show({ title: 'Saved', description: 'Representative Toast content.', variant: 'success' })
      }
      variant="outline"
    >
      Show toast
    </Button>
  );
}

export default function App() {
  const [checked, setChecked] = React.useState(false);
  const [plan, setPlan] = React.useState<string | undefined>('pro');
  const [selectedDate, setSelectedDate] = React.useState<CalendarDate | null>(null);
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']} className="flex-1">
          <ScrollView contentContainerStyle={{ padding: 24, maxWidth: isWide ? 640 : undefined, alignSelf: 'center', width: '100%' }}>
            <Card className="gap-4">
              <Text variant="title">BeeUI Expo package consumer</Text>
              <Text variant="body">
                Consuming @beeui/ui via packed tarballs. Color scheme: {colorScheme ?? 'unknown'}. Layout:{' '}
                {isWide ? 'wide' : 'narrow'}.
              </Text>

              <Input accessibilityLabel="Project name" placeholder="Project name" />
              <Checkbox checked={checked} label="Enable notifications" onCheckedChange={setChecked} />

              <Select onValueChange={setPlan} value={plan}>
                <SelectTrigger accessibilityLabel="Plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>

              <Tooltip>
                <TooltipTrigger variant="outline">Hold for tooltip</TooltipTrigger>
                <TooltipContent>Representative Tooltip content.</TooltipContent>
              </Tooltip>

              <Dialog>
                <DialogTrigger>Open dialog</DialogTrigger>
                <DialogContent>
                  <DialogTitle>Expo consumer dialog</DialogTitle>
                  <DialogDescription>Overlay rendered through Expo's Modal path.</DialogDescription>
                  <DialogFooter>
                    <DialogClose variant="outline">Close</DialogClose>
                    <Button>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger>Open sheet</SheetTrigger>
                <SheetContent>
                  <SheetTitle>@gorhom/bottom-sheet native adapter</SheetTitle>
                  <SheetDescription>Confirms Sheet mounts and closes on this consumer.</SheetDescription>
                  <SheetFooter>
                    <SheetClose variant="outline">Dismiss</SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              <Calendar accessibilityLabel="Pick a date" onValueChange={setSelectedDate} value={selectedDate} />

              <Table accessibilityLabel="Representative data table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Ada Lovelace</TableCell>
                    <TableCell>{plan ?? 'none'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <ToastDemo />
            </Card>
          </ScrollView>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
