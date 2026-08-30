import { cn } from '@beeui/core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

export type AppHeaderProps = Omit<ViewProps, 'children'> & {
  bordered?: boolean;
  className?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  leading?: React.ReactNode;
  title: React.ReactNode;
  titleClassName?: string;
  trailing?: React.ReactNode;
};

export const AppHeader = React.forwardRef<React.ComponentRef<typeof View>, AppHeaderProps>(
  (
    {
      bordered = true,
      className,
      description,
      descriptionClassName,
      leading,
      title,
      titleClassName,
      trailing,
      ...props
    },
    ref,
  ) => (
    <View
      ref={ref}
      className={cn(
        // flex-wrap + a real title min-width let the header degrade by adding
        // rows when leading/trailing controls outgrow a narrow or text-scaled
        // viewport. Without it the title column is crushed toward zero width
        // and the grown header can squeeze the content region unusable.
        'min-h-16 w-full flex-row flex-wrap items-center gap-3 bg-background px-4 py-3',
        bordered && 'border-b border-border',
        className,
      )}
      {...props}
    >
      {leading ? <Box className="shrink-0">{leading}</Box> : null}
      <Box className="min-w-32 flex-1 gap-0.5">
        {typeof title === 'string' || typeof title === 'number' ? (
          <Text accessibilityRole="header" className={titleClassName} variant="heading">
            {title}
          </Text>
        ) : (
          title
        )}
        {description ? (
          typeof description === 'string' || typeof description === 'number' ? (
            <Text className={descriptionClassName} tone="muted" variant="caption">
              {description}
            </Text>
          ) : (
            description
          )
        ) : null}
      </Box>
      {/*
        `ms-auto` (margin-inline-start: auto) — not the physical `ml-auto` —
        absorbs the row's remaining space on the trailing control's *logical*
        start side, which keeps it anchored to its logical end (visual right
        in LTR, visual left in RTL) when it wraps onto its own row. A
        physical `ml-auto` would stay pinned to the visual right under RTL
        instead of mirroring (found via #142's real-Chromium RTL stress
        matrix, `component-rtl-stress-showcase.spec.ts`).
      */}
      {trailing ? <Box className="ms-auto shrink-0">{trailing}</Box> : null}
    </View>
  ),
);

AppHeader.displayName = 'AppHeader';
