import {
  Box,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  HStack,
  Section,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Separator,
  Text,
  VStack,
} from '@beeui/ui';
import * as React from 'react';

const SelectConsumerContext = React.createContext('select-context-default');

function SelectContextProbe({ testID }: { testID: string }) {
  return <Text testID={testID}>{`context: ${React.useContext(SelectConsumerContext)}`}</Text>;
}

const LONG_OPTIONS = Array.from({ length: 120 }, (_, index) => ({
  label: `Workspace ${String(index + 1).padStart(3, '0')}`,
  value: `workspace-${index + 1}`,
}));

export function SelectShowcase() {
  const [controlledValue, setControlledValue] = React.useState('pro');

  return (
    <SelectConsumerContext.Provider value="preserved">
      <VStack gap="lg">
        <Card className="gap-5" variant="raised">
          <Section
            description="Select owns persistent option/value semantics. It reuses the anchored overlay runtime but not DropdownMenu command semantics."
            title="Production Select"
          >
            <VStack gap="lg">
              <VStack gap="xs">
                <Text variant="label">Controlled value</Text>
                <Select onValueChange={setControlledValue} value={controlledValue}>
                  <SelectTrigger
                    accessibilityLabel="Account plan"
                    testID="select-showcase-controlled-trigger"
                  >
                    <SelectValue
                      placeholder="Choose a plan"
                      testID="select-showcase-controlled-value"
                    />
                  </SelectTrigger>
                  <SelectContent testID="select-showcase-controlled-content">
                    <SelectGroup>
                      <SelectLabel>Plans</SelectLabel>
                      <SelectItem testID="select-showcase-controlled-starter" value="starter">
                        Starter
                      </SelectItem>
                      <SelectItem testID="select-showcase-controlled-pro" value="pro">
                        Pro
                      </SelectItem>
                      <SelectItem disabled value="enterprise">
                        Enterprise — invite only
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Text testID="select-showcase-controlled-state" tone="muted" variant="caption">
                  {`value: ${controlledValue}`}
                </Text>
              </VStack>

              <Separator />

              <HStack gap="lg" wrap>
                <VStack className="min-w-52 flex-1" gap="xs">
                  <Text variant="label">Placeholder / uncontrolled</Text>
                  <Select>
                    <SelectTrigger
                      accessibilityLabel="Project role"
                      testID="select-showcase-placeholder-trigger"
                    >
                      <SelectValue
                        placeholder="Choose a role"
                        testID="select-showcase-placeholder-value"
                      />
                    </SelectTrigger>
                    <SelectContent testID="select-showcase-placeholder-content">
                      <SelectItem testID="select-showcase-placeholder-designer" value="designer">
                        Designer
                      </SelectItem>
                      <SelectItem testID="select-showcase-placeholder-engineer" value="engineer">
                        Engineer
                      </SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                    </SelectContent>
                  </Select>
                </VStack>

                <VStack className="min-w-52 flex-1" gap="xs">
                  <Text variant="label">Disabled Select</Text>
                  <Select disabled defaultValue="locked">
                    <SelectTrigger testID="select-showcase-disabled-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="locked">Managed by organization</SelectItem>
                    </SelectContent>
                  </Select>
                </VStack>
              </HStack>

              <Separator />

              <VStack gap="xs">
                <Text variant="label">Grouped options</Text>
                <Select defaultValue="tokyo">
                  <SelectTrigger accessibilityLabel="Office" testID="select-showcase-group-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Asia Pacific</SelectLabel>
                      <SelectItem value="tokyo">Tokyo</SelectItem>
                      <SelectItem value="singapore">Singapore</SelectItem>
                      <SelectItem value="sydney">Sydney</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Europe</SelectLabel>
                      <SelectItem value="paris">Paris</SelectItem>
                      <SelectItem value="london">London</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </VStack>

              <Separator />

              <VStack gap="xs">
                <Text variant="label">Consumer context through root portal</Text>
                <Select defaultValue="context">
                  <SelectTrigger testID="select-showcase-context-trigger">
                    <SelectValue testID="select-showcase-context-value" />
                  </SelectTrigger>
                  <SelectContent testID="select-showcase-context-content">
                    <SelectItem textValue="Context-aware option" value="context">
                      <SelectContextProbe testID="select-showcase-context-probe" />
                    </SelectItem>
                    <SelectItem value="plain">Plain option</SelectItem>
                  </SelectContent>
                </Select>
              </VStack>
            </VStack>
          </Section>
        </Card>

        <Card className="gap-5">
          <Section
            description="The list stays a ScrollView in v1. A 120-option fixture validates viewport max-height, collision, selected-item scrolling, and ordinary press/keyboard selection without adding virtualization."
            title="Long list"
          >
            <Select defaultValue="workspace-118">
              <SelectTrigger accessibilityLabel="Workspace" testID="select-showcase-long-trigger">
                <SelectValue testID="select-showcase-long-value" />
              </SelectTrigger>
              <SelectContent maxHeight={220} testID="select-showcase-long-content">
                {LONG_OPTIONS.map((option, index) => (
                  <SelectItem
                    key={option.value}
                    testID={
                      index === 0
                        ? 'select-showcase-long-first'
                        : index === LONG_OPTIONS.length - 1
                          ? 'select-showcase-long-last'
                          : undefined
                    }
                    value={option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>
        </Card>

        <Card className="gap-5">
          <Section
            description="The same selection API is rendered in a deliberately narrow container and inside Dialog's modal-local overlay host."
            title="Narrow viewport and Dialog nesting"
          >
            <VStack gap="lg">
              <Box className="w-full max-w-64" testID="select-showcase-narrow-shell">
                <Select defaultValue="very-long-option">
                  <SelectTrigger accessibilityLabel="Narrow Select" testID="select-showcase-narrow-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short option</SelectItem>
                    <SelectItem value="very-long-option">
                      A long option label that must truncate safely in a narrow layout
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Box>

              <Dialog>
                <DialogTrigger testID="select-showcase-dialog-trigger" variant="outline">
                  Select inside Dialog
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Assign owner</DialogTitle>
                  <DialogDescription>
                    Select content resolves against this Dialog's modal-local host while preserving consumer context.
                  </DialogDescription>
                  <Select defaultValue="context-user">
                    <SelectTrigger
                      accessibilityLabel="Owner"
                      testID="select-showcase-dialog-select-trigger"
                    >
                      <SelectValue testID="select-showcase-dialog-select-value" />
                    </SelectTrigger>
                    <SelectContent testID="select-showcase-dialog-select-content">
                      <SelectItem textValue="Context user" value="context-user">
                        <SelectContextProbe testID="select-showcase-dialog-context-probe" />
                      </SelectItem>
                      <SelectItem
                        testID="select-showcase-dialog-alex"
                        value="alex"
                      >
                        Alex Morgan
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <DialogFooter>
                    <DialogClose variant="outline">Done</DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </VStack>
          </Section>
        </Card>
      </VStack>
    </SelectConsumerContext.Provider>
  );
}
