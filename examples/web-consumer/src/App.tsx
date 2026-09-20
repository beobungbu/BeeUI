import {
  BeeThemeScope,
  BeeUIProvider,
  Box,
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
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
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
  useBeeToken,
  type CalendarDate,
} from '@beemvp/beeui-ui';
import * as React from 'react';

/**
 * Reads and renders the resolved `colors.primary` token so its value can be compared
 * inside vs. outside a `BeeThemeScope` — see `App`'s "Package boundary" section below.
 */
function PrimaryTokenReadout({ testID }: { testID: string }) {
  const primary = useBeeToken('colors.primary');
  return <Text testID={testID}>{primary}</Text>;
}

/**
 * R10.4 (#233) — independent Web reference consumer.
 *
 * Proves BeeUI works through the ordinary Vite + react-native-web toolchain
 * path (no Expo, no Showcase internals): provider/theme wiring, forms,
 * anchored overlays (Popover/Select/Tooltip/Dialog), the Web Sheet path,
 * Table, and Calendar all render and interact correctly in a plain browser
 * build. See ../README.md for the packed-tarball setup this depends on.
 *
 * The "Package boundary" section additionally proves `BeeThemeScope`/`useBeeToken`
 * resolve correctly through the packed tarball, not just the barrel import compiling:
 * a `BeeThemeScope` scoped to a different brand/appearance than the ambient app theme
 * wraps a second, identically-styled swatch and token readout, so the two computed
 * `--color-primary` values and the two `useBeeToken` readouts can be compared.
 */
export function App() {
  const [checked, setChecked] = React.useState(false);
  const [plan, setPlan] = React.useState<string | undefined>('pro');
  const [selectedDate, setSelectedDate] = React.useState<CalendarDate | null>(null);

  return (
    <BeeUIProvider>
      <Screen>
        <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
          <Card className="gap-4">
            <Text variant="title">BeeUI Web consumer starter</Text>
            <Text variant="body">Vite + react-native-web, consuming @beemvp/beeui-ui as a packed package.</Text>

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

            <Popover>
              <PopoverTrigger variant="outline">Open popover</PopoverTrigger>
              <PopoverContent>
                <PopoverTitle>Representative Popover</PopoverTitle>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger variant="outline">Hover for tooltip</TooltipTrigger>
              <TooltipContent>Representative Tooltip content.</TooltipContent>
            </Tooltip>

            <Dialog>
              <DialogTrigger>Open dialog</DialogTrigger>
              <DialogContent>
                <DialogTitle>Web consumer dialog</DialogTitle>
                <DialogDescription>Overlay rendered through react-native-web's Modal path.</DialogDescription>
                <DialogFooter>
                  <DialogClose variant="outline">Close</DialogClose>
                  <Button>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger>Open sheet</SheetTrigger>
              <SheetContent>
                <SheetTitle>Representative Sheet</SheetTitle>
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

            <Card className="gap-2">
              <Text variant="title">Package boundary: BeeThemeScope + useBeeToken</Text>
              <Box className="h-8 w-16 rounded-md bg-primary" testID="ambient-primary-swatch" />
              <PrimaryTokenReadout testID="ambient-primary-token" />
              <BeeThemeScope appearance="dark" brand="violet">
                <Box className="h-8 w-16 rounded-md bg-primary" testID="scoped-primary-swatch" />
                <PrimaryTokenReadout testID="scoped-primary-token" />
              </BeeThemeScope>
            </Card>
          </Card>
        </div>
      </Screen>
    </BeeUIProvider>
  );
}
