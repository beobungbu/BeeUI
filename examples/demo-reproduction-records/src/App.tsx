import { AppHeader, BeeUIProvider, Box, SafeArea } from '@beemvp/beeui-ui';

import { RecordsScreen } from './records/records-screen';

// App shell per llms-full "Provider and safe-area setup" + cookbook §5:
// BeeUIProvider at the root installs the safe-area, toast, and anchored-overlay
// runtimes; SafeArea owns the edges around the header/content.
export function App() {
  return (
    <BeeUIProvider>
      <SafeArea edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-background">
        <AppHeader
          title="BeeUI demo reproduction"
          description="Searchable / filterable records table (#260), rebuilt from AI-agent docs only"
        />
        <Box className="mx-auto w-full max-w-5xl flex-1">
          <RecordsScreen />
        </Box>
      </SafeArea>
    </BeeUIProvider>
  );
}
