import { AppHeader, Box } from '@beemvp/beeui-ui';
import * as React from 'react';
import { ScrollView } from 'react-native';

export type ScreenShellProps = {
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: string;
  testID: string;
  title: string;
};

export function ScreenShell({ action, children, description, testID, title }: ScreenShellProps) {
  return (
    <Box className="flex-1 bg-background" testID={testID}>
      <AppHeader description={description} title={title} trailing={action} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <Box className="w-full max-w-6xl self-center gap-6 px-4 py-5">{children}</Box>
      </ScrollView>
    </Box>
  );
}
