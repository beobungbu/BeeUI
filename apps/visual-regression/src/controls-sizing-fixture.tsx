import {
  Box,
  Button,
  ButtonLabel,
  IconButton,
  Input,
  SearchInput,
  SegmentedControl,
  SegmentedControlItem,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

/**
 * Real-layout geometry fixture for the text-bearing controls that consumers
 * measured as clipped, broken mid-word, mis-sized or mis-aligned:
 * `Input`/`SearchInput` line box vs. glyph extents and placeholder colour,
 * `SegmentedControl` in a narrow container, `IconButton` per-size rendered
 * box, and a wrapped `Button` label. `tests/controls-sizing.spec.ts` measures
 * it.
 */
export function ControlsSizingFixture() {
  const [unit, setUnit] = React.useState('chai');
  const [theme, setTheme] = React.useState('system');

  return (
    <Box className="gap-6 p-6" testID="controls-sizing-fixture">
      <Box className="gap-3">
        <Input size="sm" testID="sizing-input-sm" value="Chuối già Nam Mỹ" />
        <Input size="md" testID="sizing-input-md" value="Chuối già Nam Mỹ" />
        <Input size="lg" testID="sizing-input-lg" value="Chuối già Nam Mỹ" />
        <SearchInput testID="sizing-search-input" value="Chuối già Nam Mỹ" />
        <Input placeholder="Tìm sản phẩm" testID="sizing-placeholder-input" />
      </Box>

      {/* A POS product-card-width column: three short Vietnamese pack sizes. */}
      <Box className="w-48" testID="sizing-segmented-narrow-container">
        <SegmentedControl
          accessibilityLabel="Pack size"
          onValueChange={setUnit}
          testID="sizing-segmented-narrow"
          value={unit}
        >
          <SegmentedControlItem testID="sizing-segment-chai" value="chai">
            chai
          </SegmentedControlItem>
          <SegmentedControlItem testID="sizing-segment-loc" value="loc">
            lốc 6
          </SegmentedControlItem>
          <SegmentedControlItem testID="sizing-segment-thung" value="thung">
            thùng 24
          </SegmentedControlItem>
        </SegmentedControl>
      </Box>

      <Box className="w-full" testID="sizing-segmented-wide-container">
        <SegmentedControl
          accessibilityLabel="Theme"
          onValueChange={setTheme}
          testID="sizing-segmented-wide"
          value={theme}
        >
          <SegmentedControlItem testID="sizing-segment-light" value="light">
            Sáng
          </SegmentedControlItem>
          <SegmentedControlItem testID="sizing-segment-dark" value="dark">
            Tối
          </SegmentedControlItem>
          <SegmentedControlItem testID="sizing-segment-system" value="system">
            Theo hệ thống
          </SegmentedControlItem>
        </SegmentedControl>
      </Box>

      <Box className="flex-row items-center gap-3">
        <IconButton accessibilityLabel="Default size" testID="sizing-icon-button-default">
          <Text>+</Text>
        </IconButton>
        <IconButton accessibilityLabel="Small" size="sm" testID="sizing-icon-button-sm">
          <Text>+</Text>
        </IconButton>
        <IconButton accessibilityLabel="Medium" size="md" testID="sizing-icon-button-md">
          <Text>+</Text>
        </IconButton>
        <IconButton accessibilityLabel="Large" size="lg" testID="sizing-icon-button-lg">
          <Text>+</Text>
        </IconButton>
      </Box>

      <Box className="w-40 gap-3">
        <Button testID="sizing-button-wrapped-string">Thêm thanh toán · 13.200 đ</Button>
        <Button testID="sizing-button-wrapped-label" variant="outline">
          <ButtonLabel>Thêm thanh toán · 13.200 đ</ButtonLabel>
        </Button>
      </Box>
    </Box>
  );
}
