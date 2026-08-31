import {
  AppHeader,
  Box,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  SafeArea,
  Screen,
  Section,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Text,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { Keyboard, ScrollView, type TextInput } from 'react-native';

/**
 * Runtime overlay-stress fixture (#126).
 *
 * Deliberately a SEPARATE screen from `runtime-acceptance.tsx`. An earlier
 * revision added this fixture's root Select and modal-local child Select
 * directly onto the shared `RuntimeAcceptance` screen; real CI evidence
 * proved that extra content shifted the shared screen's layout enough to
 * clip the pre-existing Toast dismissal path. All #126 stress content lives
 * here so the baseline runtime screen remains behaviorally isolated.
 */
export function RuntimeStressAcceptance({ onBack }: { onBack: () => void }) {
  const [rootSelectValue, setRootSelectValue] = React.useState('none');
  const [dialogSelectValue, setDialogSelectValue] = React.useState('none');
  const dialogInputRef = React.useRef<TextInput>(null);
  const [keyboardShown, setKeyboardShown] = React.useState(false);

  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const toggleDialogInputFocus = React.useCallback(() => {
    const input = dialogInputRef.current;
    if (!input) return;
    if (input.isFocused()) input.blur();
    else input.focus();
  }, []);

  return (
    <Screen testID="runtime-stress-smoke">
      <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
        <AppHeader
          description="Isolated #126 native movement/scroll/keyboard stress fixtures. Not a production component surface."
          leading={
            <Button
              accessibilityLabel="Back to Showcase home"
              onPress={onBack}
              size="sm"
              testID="runtime-stress-back"
              variant="ghost"
            >
              Back
            </Button>
          }
          title="Runtime Stress"
        />
      </SafeArea>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} testID="runtime-stress-scroll">
        <Box className="w-full gap-6 px-5 py-8">
          <Text testID="runtime-stress-ready" variant="heading">Runtime stress fixture ready</Text>

          <Card className="gap-4" variant="raised">
            <Section
              description="Same anchored-overlay kernel as root Popover/DropdownMenu, exercised as first-class #126 evidence."
              title="Root Select"
            >
              <VStack gap="sm">
                <Select
                  onValueChange={setRootSelectValue}
                  value={rootSelectValue === 'none' ? undefined : rootSelectValue}
                >
                  <SelectTrigger testID="runtime-stress-select-trigger">
                    <SelectValue placeholder="Open root Select" testID="runtime-stress-select-value" />
                  </SelectTrigger>
                  <SelectContent testID="runtime-stress-select-content">
                    <SelectGroup>
                      <SelectLabel>Runtime stress select</SelectLabel>
                      <SelectItem testID="runtime-stress-select-item-alpha" value="alpha">Alpha</SelectItem>
                      <SelectItem testID="runtime-stress-select-item-beta" value="beta">Beta</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Text testID="runtime-stress-select-selection">{`select: ${rootSelectValue}`}</Text>
              </VStack>
            </Section>
          </Card>

          <Card className="gap-4" variant="raised">
            <Section
              description="Outside press dismisses the Popover; a subsequent independent scroll gesture must remain interactive, move the trigger out of the viewport, and allow a coherent reopen after returning."
              title="Movement stress"
            >
              <VStack gap="sm">
                <Popover>
                  <PopoverTrigger testID="runtime-stress-popover-trigger" variant="outline">
                    Open movement Popover
                  </PopoverTrigger>
                  <PopoverContent placement="bottom" testID="runtime-stress-popover-content">
                    <PopoverTitle>Movement stress Popover</PopoverTitle>
                    <PopoverDescription>
                      Dismiss, scroll away, return, and reopen without stranding the overlay.
                    </PopoverDescription>
                    <PopoverClose testID="runtime-stress-popover-close">Close</PopoverClose>
                  </PopoverContent>
                </Popover>
              </VStack>
            </Section>
          </Card>

          <Card className="h-[220px] justify-center gap-2" variant="raised">
            <Text testID="runtime-stress-scroll-sentinel-1" variant="heading">Scroll corridor 1</Text>
            <Text>Visible movement sentinel one.</Text>
          </Card>
          <Card className="h-[220px] justify-center gap-2" variant="raised">
            <Text testID="runtime-stress-scroll-sentinel-2" variant="heading">Scroll corridor 2</Text>
            <Text>Visible movement sentinel two.</Text>
          </Card>
          <Card className="h-[220px] justify-center gap-2" variant="raised">
            <Text testID="runtime-stress-scroll-sentinel-3" variant="heading">Scroll corridor 3</Text>
            <Text>Visible movement sentinel three.</Text>
          </Card>

          <Card className="gap-4" variant="raised">
            <Section description="Root-scope target for the movement-stress scroll gesture." title="Scroll target">
              <Text testID="runtime-stress-scroll-target">Movement stress scroll target reached</Text>
            </Section>
          </Card>

          <Card className="gap-4" variant="raised">
            <Section
              description="Dialog scope reuses the same geometry/runtime/dismiss kernel as root overlays; adds a modal-local child Select and a real-keyboard host-move-remeasure check on the child Popover, per #126."
              title="Modal-local child overlays"
            >
              <VStack gap="sm">
                <Dialog>
                  <DialogTrigger testID="runtime-stress-dialog-trigger" variant="outline">
                    Open stress Dialog
                  </DialogTrigger>
                  <DialogContent testID="runtime-stress-dialog-content">
                    <DialogTitle>Runtime stress Dialog</DialogTitle>
                    <DialogDescription>
                      Modal-local child Select and keyboard-driven host-move remeasure evidence for #126.
                    </DialogDescription>

                    <Popover>
                      <PopoverTrigger testID="runtime-stress-dialog-popover-trigger" variant="outline">
                        Child Popover
                      </PopoverTrigger>
                      <PopoverContent testID="runtime-stress-dialog-popover-content">
                        <PopoverTitle>Child Popover</PopoverTitle>
                        <Text testID="runtime-stress-keyboard-state">
                          {`keyboard: ${keyboardShown ? 'shown' : 'hidden'}`}
                        </Text>
                        <Button
                          onPress={toggleDialogInputFocus}
                          size="sm"
                          testID="runtime-stress-dialog-popover-keyboard-toggle"
                          variant="outline"
                        >
                          Toggle input focus
                        </Button>
                        <PopoverClose testID="runtime-stress-dialog-popover-close" size="sm">
                          Close child Popover
                        </PopoverClose>
                      </PopoverContent>
                    </Popover>

                    <Select
                      onValueChange={setDialogSelectValue}
                      value={dialogSelectValue === 'none' ? undefined : dialogSelectValue}
                    >
                      <SelectTrigger testID="runtime-stress-dialog-select-trigger">
                        <SelectValue placeholder="Child Select" testID="runtime-stress-dialog-select-value" />
                      </SelectTrigger>
                      <SelectContent testID="runtime-stress-dialog-select-content">
                        <SelectGroup>
                          <SelectLabel>Dialog select</SelectLabel>
                          <SelectItem testID="runtime-stress-dialog-select-item" value="selected">
                            Select child option
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Text testID="runtime-stress-dialog-select-selection">
                      {`select selection: ${dialogSelectValue}`}
                    </Text>

                    <Field label="Dialog input">
                      <Input
                        autoCapitalize="none"
                        placeholder="stress dialog input"
                        ref={dialogInputRef}
                        testID="runtime-stress-dialog-input"
                      />
                    </Field>

                    <DialogFooter>
                      <DialogClose testID="runtime-stress-dialog-close" variant="outline">
                        Close Dialog
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </VStack>
            </Section>
          </Card>
        </Box>
      </ScrollView>
    </Screen>
  );
}
