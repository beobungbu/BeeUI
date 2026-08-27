import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
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
  Separator,
  Text,
  useToast,
  VStack,
} from '@beeui/ui';
import * as React from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Uniwind, useUniwind } from 'uniwind';

// Extra space kept between the focused input's bottom edge and the top of
// the keyboard once scrolled into view.
const KEYBOARD_SCROLL_MARGIN = 24;

function ControlledPresentationDialog({
  presentationStyle,
  testPrefix,
  title,
}: {
  presentationStyle: 'overFullScreen' | 'pageSheet' | 'formSheet';
  testPrefix: string;
  title: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [requestCloseCount, setRequestCloseCount] = React.useState(0);
  const [menuSelection, setMenuSelection] = React.useState('none');

  return (
    <VStack gap="sm">
      <Text testID={`${testPrefix}-state`}>{`${presentationStyle} state: ${open ? 'open' : 'closed'}`}</Text>
      <Text testID={`${testPrefix}-request-close`}>{`${presentationStyle} requestClose: ${requestCloseCount}`}</Text>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger testID={`${testPrefix}-trigger`} variant="outline">
          {`Open ${title}`}
        </DialogTrigger>
        <DialogContent
          modalProps={{ presentationStyle }}
          onRequestClose={() => setRequestCloseCount((count) => count + 1)}
          testID={`${testPrefix}-content`}
        >
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Runtime-only fixture for native presentation, child-overlay coordinates, focus, and request-close behavior.
          </DialogDescription>

          <Popover>
            <PopoverTrigger testID={`${testPrefix}-popover-trigger`} variant="outline">
              Child Popover
            </PopoverTrigger>
            <PopoverContent placement="bottom" testID={`${testPrefix}-popover-content`}>
              <PopoverTitle>{`${title} Popover`}</PopoverTitle>
              <PopoverDescription>
                This child must resolve inside the presentation-local overlay scope.
              </PopoverDescription>
              <PopoverClose testID={`${testPrefix}-popover-close`} size="sm">
                Close child Popover
              </PopoverClose>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger testID={`${testPrefix}-menu-trigger`} variant="outline">
              Child Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent testID={`${testPrefix}-menu-content`}>
              <DropdownMenuLabel>{`${title} menu`}</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setMenuSelection('selected')}
                testID={`${testPrefix}-menu-item`}
              >
                Select child item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Text testID={`${testPrefix}-menu-selection`}>{`menu selection: ${menuSelection}`}</Text>

          <Field label="Sheet input">
            <Input
              autoCapitalize="none"
              placeholder="runtime sheet input"
              testID={`${testPrefix}-input`}
            />
          </Field>

          <DialogFooter>
            <DialogClose testID={`${testPrefix}-close`} variant="outline">
              Close {title}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}

export function RuntimeAcceptance({ onBack }: { onBack: () => void }) {
  const { theme } = useUniwind();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [rootMenuSelection, setRootMenuSelection] = React.useState('none');

  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollOffsetRef = React.useRef(0);
  const runtimeInputRef = React.useRef<React.ComponentRef<typeof Input>>(null);
  // Guards against re-applying the correction: `keyboardDidShow` can fire
  // more than once while the keyboard settles (e.g. once the suggestion
  // strip finishes loading), and an animated `scrollTo` does not update the
  // ScrollView's real (not just reported) offset synchronously — reacting to
  // a second event before the first correction has landed would stack both
  // adjustments and overshoot well past the keyboard.
  const hasAdjustedForKeyboardRef = React.useRef(false);

  React.useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    // Expo's `edgeToEdgeEnabled` config (and, as of Android 16, the platform
    // itself) disables the native `adjustResize` window behavior, so the
    // window never shrinks for the soft keyboard. Android's own "scroll the
    // focused view into sight" only runs once, at focus time, before the
    // keyboard exists to account for — a `KeyboardAvoidingView` resize after
    // the fact does not retrigger it. Re-scroll explicitly once the
    // keyboard's real on-screen position is known.
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      if (hasAdjustedForKeyboardRef.current) {
        return;
      }

      const input = runtimeInputRef.current;
      const scrollNode = scrollRef.current;
      if (!input || !scrollNode) {
        return;
      }

      input.measureInWindow((_x, y, _width, height) => {
        const inputBottom = y + height;
        const keyboardTop = event.endCoordinates.screenY;
        const overlap = inputBottom - keyboardTop;
        if (overlap > 0) {
          hasAdjustedForKeyboardRef.current = true;
          // Instant, not animated: an in-flight animation's visual position
          // lags its logical target, so a second read of `measureInWindow`
          // before it settles would double-count the already-queued delta.
          scrollNode.scrollTo({
            animated: false,
            y: scrollOffsetRef.current + overlap + KEYBOARD_SCROLL_MARGIN,
          });
        }
      });
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      hasAdjustedForKeyboardRef.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <Screen testID="runtime-smoke">
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
        <AppHeader
          description="Stable testIDs and isolated native-only acceptance fixtures. Not a production component surface."
          leading={
            <Button
              accessibilityLabel="Back to Showcase home"
              onPress={onBack}
              size="sm"
              testID="runtime-back"
              variant="ghost"
            >
              Back
            </Button>
          }
          title="Runtime Acceptance"
        />
      </SafeArea>

      <SafeArea className="flex-1" edges={['left', 'right', 'bottom']}>
        {/*
          iOS keeps its native keyboard-avoidance via `padding`. Android gets
          its scroll-to-focused-input handled explicitly above (see the
          `keyboardDidShow` effect) because edge-to-edge disables the native
          window resize that `KeyboardAvoidingView`'s Android "height" mode
          depends on to reveal a re-scrolled input.
        */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => {
              scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
            }}
            ref={scrollRef}
            scrollEventThrottle={16}
            testID="runtime-scroll"
          >
            <Box className="mx-auto w-full max-w-3xl gap-6 px-5 py-8">
              <Text testID="runtime-ready" variant="heading">Runtime fixture ready</Text>
              <Text
                testID={insets.top > 0 ? 'runtime-safe-area-nonzero' : 'runtime-safe-area-zero'}
              >
                {`safe-area top: ${insets.top} bottom: ${insets.bottom}`}
              </Text>

              <Card className="gap-4" variant="raised">
                <Section
                  description="Explicit light/dark controls avoid system-theme ambiguity in runtime automation."
                  title="Theme"
                >
                  <VStack gap="sm">
                    <Text testID="runtime-theme-state">{`theme: ${theme}`}</Text>
                    <Button
                      onPress={() => Uniwind.setTheme('light')}
                      testID="runtime-theme-light"
                      variant="outline"
                    >
                      Force light
                    </Button>
                    <Button
                      onPress={() => Uniwind.setTheme('dark')}
                      testID="runtime-theme-dark"
                      variant="outline"
                    >
                      Force dark
                    </Button>
                  </VStack>
                </Section>
              </Card>

              <Card className="gap-4" variant="raised">
                <Section description="Root-scope modal and anchored overlays." title="Root overlays">
                  <VStack gap="sm">
                    <Dialog>
                      <DialogTrigger testID="runtime-dialog-trigger">Open root Dialog</DialogTrigger>
                      <DialogContent testID="runtime-dialog-content">
                        <DialogTitle>Runtime root Dialog</DialogTitle>
                        <DialogDescription>Simple open/close contract.</DialogDescription>
                        <DialogClose testID="runtime-dialog-close">Close root Dialog</DialogClose>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger testID="runtime-alert-trigger" variant="destructive">
                        Open AlertDialog
                      </AlertDialogTrigger>
                      <AlertDialogContent cancelOnRequestClose={false} testID="runtime-alert-content">
                        <AlertDialogTitle>Runtime AlertDialog</AlertDialogTitle>
                        <AlertDialogDescription>
                          Hardware back must not bypass the explicit confirmation policy.
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                          <AlertDialogCancel testID="runtime-alert-cancel">Cancel</AlertDialogCancel>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Popover>
                      <PopoverTrigger testID="runtime-popover-trigger" variant="outline">
                        Open root Popover
                      </PopoverTrigger>
                      <PopoverContent placement="bottom" testID="runtime-popover-content">
                        <PopoverTitle>Runtime root Popover</PopoverTitle>
                        <PopoverDescription testID="runtime-popover-copy">
                          Root Popover content is visible.
                        </PopoverDescription>
                        <PopoverClose testID="runtime-popover-close">Close root Popover</PopoverClose>
                      </PopoverContent>
                    </Popover>

                    <DropdownMenu>
                      <DropdownMenuTrigger testID="runtime-menu-trigger" variant="outline">
                        Open root Menu
                      </DropdownMenuTrigger>
                      <DropdownMenuContent testID="runtime-menu-content">
                        <DropdownMenuLabel>Runtime menu</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => setRootMenuSelection('alpha')}
                          testID="runtime-menu-item"
                        >
                          Select alpha
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Text testID="runtime-menu-selection">{`selection: ${rootMenuSelection}`}</Text>
                  </VStack>
                </Section>
              </Card>

              <Card className="gap-4" variant="raised">
                <Section description="Child-first dismiss behavior inside a Dialog scope." title="Nested overlays">
                  <VStack gap="sm">
                    <Dialog>
                      <DialogTrigger testID="runtime-dialog-menu-trigger">Dialog → Menu</DialogTrigger>
                      <DialogContent testID="runtime-dialog-menu-content">
                        <DialogTitle>Dialog with child Menu</DialogTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger testID="runtime-dialog-child-menu-trigger" variant="outline">
                            Open child Menu
                          </DropdownMenuTrigger>
                          <DropdownMenuContent testID="runtime-dialog-child-menu-content">
                            <DropdownMenuLabel>Child menu</DropdownMenuLabel>
                            <DropdownMenuItem testID="runtime-dialog-child-menu-item">
                              Child action
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DialogClose testID="runtime-dialog-menu-close">Close Dialog</DialogClose>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger testID="runtime-dialog-popover-trigger">Dialog → Popover</DialogTrigger>
                      <DialogContent testID="runtime-dialog-popover-content">
                        <DialogTitle>Dialog with child Popover</DialogTitle>
                        <Popover>
                          <PopoverTrigger testID="runtime-dialog-child-popover-trigger" variant="outline">
                            Open child Popover
                          </PopoverTrigger>
                          <PopoverContent testID="runtime-dialog-child-popover-content">
                            <PopoverTitle>Child Popover</PopoverTitle>
                            <PopoverClose testID="runtime-dialog-child-popover-close">
                              Close child Popover
                            </PopoverClose>
                          </PopoverContent>
                        </Popover>
                        <DialogClose testID="runtime-dialog-popover-close">Close Dialog</DialogClose>
                      </DialogContent>
                    </Dialog>
                  </VStack>
                </Section>
              </Card>

              <Card className="gap-4" variant="raised">
                <Section description="Persistent notification with explicit dismissal." title="Toast">
                  <VStack gap="sm">
                    <Button
                      onPress={() =>
                        toast.show({
                          title: 'Runtime toast',
                          description: 'Persistent runtime acceptance toast.',
                          duration: 'persistent',
                        })
                      }
                      testID="runtime-toast-show"
                      variant="outline"
                    >
                      Show runtime Toast
                    </Button>
                    <Button onPress={toast.dismissAll} testID="runtime-toast-dismiss" variant="ghost">
                      Dismiss runtime Toast
                    </Button>
                  </VStack>
                </Section>
              </Card>

              <Card className="gap-4" variant="raised">
                <Section description="Keyboard/focus and reduced-height scroll target." title="Focus and scrolling">
                  <Field label="Runtime input">
                    <Input
                      autoCapitalize="none"
                      placeholder="runtime input"
                      ref={runtimeInputRef}
                      testID="runtime-input"
                    />
                  </Field>
                  <Text testID="runtime-keyboard-usable">
                    This content must remain reachable while the keyboard reduces usable height.
                  </Text>
                </Section>
              </Card>

              <Card className="gap-5" variant="raised">
                <Section
                  description="Controlled native presentation styles with child anchored overlays and request-close counters."
                  title="iOS presentations"
                >
                  <VStack gap="lg">
                    <ControlledPresentationDialog
                      presentationStyle="overFullScreen"
                      testPrefix="runtime-over-full-screen"
                      title="overFullScreen"
                    />
                    <Separator />
                    <ControlledPresentationDialog
                      presentationStyle="pageSheet"
                      testPrefix="runtime-page-sheet"
                      title="pageSheet"
                    />
                    <Separator />
                    <ControlledPresentationDialog
                      presentationStyle="formSheet"
                      testPrefix="runtime-form-sheet"
                      title="formSheet"
                    />
                  </VStack>
                </Section>
              </Card>

              <Box className="h-48" />
              <Text testID="runtime-scroll-end" variant="heading">Runtime scroll end</Text>
            </Box>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeArea>
    </Screen>
  );
}
