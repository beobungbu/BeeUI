import './global.css';

import {
  BeeUIProvider,
  Button,
  Calendar,
  Card,
  Checkbox,
  DateTimePicker,
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
  type CalendarDate,
  type DateTimePickerValue,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { BackHandler, ScrollView } from 'react-native';

/**
 * R10.3 (#232) — true bare React Native consumer.
 *
 * Exercises the surfaces #232's DoD enumerates: provider/theme, forms
 * (Input/Checkbox), anchored overlays (Dialog/Select/Tooltip), the native
 * Sheet dependency (@gorhom/bottom-sheet), Table, and SafeArea. The
 * `BackHandler` wiring below is compile/import evidence only — Android Back
 * dismissal itself requires a device/emulator runtime pass, which this
 * headless Metro-bundle acceptance does not attempt (see ../README.md's
 * "compile vs runtime evidence" note).
 */
export default function App() {
  const [checked, setChecked] = React.useState(false);
  const [plan, setPlan] = React.useState<string | undefined>('pro');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<CalendarDate | null>(null);
  const [dateTime, setDateTime] = React.useState<DateTimePickerValue | null>(null);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheetOpen) {
        setSheetOpen(false);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [sheetOpen]);

  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']} className="flex-1">
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <Card className="gap-4">
              <Text variant="title">BeeUI bare React Native starter</Text>
              <Text variant="body">Package-consumption via packed tarballs; no Expo runtime.</Text>

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
                  <DialogTitle>Bare RN dialog</DialogTitle>
                  <DialogDescription>React Native core Modal without the Expo runtime.</DialogDescription>
                  <DialogFooter>
                    <DialogClose variant="outline">Close</DialogClose>
                    <Button>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Sheet onOpenChange={setSheetOpen} open={sheetOpen}>
                <SheetTrigger>Open sheet</SheetTrigger>
                <SheetContent>
                  <SheetTitle>@gorhom/bottom-sheet native adapter</SheetTitle>
                  <SheetDescription>
                    Hardware Back (Android) closes this sheet via the BackHandler listener above.
                  </SheetDescription>
                  <SheetFooter>
                    <SheetClose variant="outline">Dismiss</SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              <Calendar accessibilityLabel="Pick a date" onValueChange={setSelectedDate} value={selectedDate} />

              <DateTimePicker
                accessibilityLabel="Pick a date and time"
                onValueChange={setDateTime}
                placeholder="Select date & time"
                value={dateTime}
              />

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
            </Card>
          </ScrollView>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
