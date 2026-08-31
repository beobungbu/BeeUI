import * as React from 'react';

// R10.2 (#231) — every import below resolves to a file copied into this
// project by `beeui add button popover` (see ../setup.sh and ../README.md).
// There is no dependency on `@beeui/ui` here at all — only the copied
// component source plus the `@beeui/tokens` runtime dependency that
// `overlay-runtime`/`popover` declare per ADR-011 D5 (#355).
import { Button } from './components/beeui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from './components/beeui/popover';
import { Text } from './components/beeui/text';

/**
 * Minimal source-ownership starter: proves the copied Button (vendored-core
 * vertical slice) and Popover (anchored-overlay + @beeui/tokens runtime
 * slice) both render and interact from fully local, editable source.
 */
export function App() {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Text variant="title">BeeUI source-ownership starter</Text>
      <Text variant="body">Button and Popover below are local source copied by `beeui add`, not `@beeui/ui`.</Text>

      <Button onPress={() => setCount((value) => value + 1)}>Clicked {count} times</Button>

      <Popover>
        <PopoverTrigger variant="outline">Open popover</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Copied Popover source</PopoverTitle>
        </PopoverContent>
      </Popover>
    </div>
  );
}
