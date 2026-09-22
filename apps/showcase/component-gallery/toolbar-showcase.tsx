import { Card, IconButton, Section, Text, Toolbar, ToolbarItem, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { View } from 'react-native';

// A fixed, narrow width forces every viewport (including a wide desktop
// browser) to overflow the same two lowest-priority items into the overflow
// menu, so this fixture's collapse behavior is deterministic rather than
// depending on the surrounding page layout.
const NARROW_TOOLBAR_WIDTH = 220;

function OrderToolbar() {
  const [lastAction, setLastAction] = React.useState('none');

  return (
    <VStack className="gap-3" testID="toolbar-showcase">
      <View style={{ width: NARROW_TOOLBAR_WIDTH }}>
        <Toolbar overflowAccessibilityLabel="More actions" testID="toolbar-showcase-toolbar">
          <ToolbarItem label="Search" onPress={() => setLastAction('search')}>
            <IconButton accessibilityLabel="Search" variant="ghost">
              🔍
            </IconButton>
          </ToolbarItem>
          <ToolbarItem label="Filter" onPress={() => setLastAction('filter')} priority={2}>
            <IconButton accessibilityLabel="Filter" variant="ghost">
              ▤
            </IconButton>
          </ToolbarItem>
          <ToolbarItem label="Export" onPress={() => setLastAction('export')} priority={1}>
            <IconButton accessibilityLabel="Export" variant="ghost">
              ⇩
            </IconButton>
          </ToolbarItem>
        </Toolbar>
      </View>
      <Text testID="toolbar-showcase-last-action" tone="muted" variant="caption">
        {`Last action: ${lastAction}`}
      </Text>
    </VStack>
  );
}

export function ToolbarShowcase() {
  return (
    <Card className="gap-4" testID="toolbar-showcase-card" variant="raised">
      <Section
        description="A single-row toolbar that measures its own width and collapses the lowest-priority items (Export, then Filter) into an overflow menu once the row no longer fits; Search never collapses because it declares no priority."
        title="Priority collapse and overflow menu"
      >
        <OrderToolbar />
      </Section>
    </Card>
  );
}
