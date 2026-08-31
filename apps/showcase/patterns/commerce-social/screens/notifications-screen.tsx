import { Avatar, Badge, Button, Card, EmptyState, HStack, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { Pressable } from 'react-native';
import type { SocialNotification } from '../fixtures/social-fixtures';
import { notifications } from '../fixtures/social-fixtures';
import { PatternScreen } from '../components/screen-shell';

export type NotificationsScreenProps = {
  empty?: boolean;
  onMarkRead?: (notification: SocialNotification) => void;
  onSelect?: (notification: SocialNotification) => void;
};

export function NotificationsScreen({ empty = false, onMarkRead, onSelect }: NotificationsScreenProps) {
  const visible = empty ? [] : notifications;
  const groups: Array<SocialNotification['group']> = ['Today', 'Earlier'];

  return (
    <PatternScreen description="Unread emphasis is visible but quiet, with timestamps supplied directly by fixture data." eyebrow="Activity" testID="notifications-screen" title="Notifications">
      {visible.length === 0 ? (
        <EmptyState description="Likes, follows, mentions, and replies will collect here." testID="notifications-empty" title="Nothing new right now" />
      ) : (
        <VStack gap="xl">
          {groups.map((group) => {
            const grouped = visible.filter((notification) => notification.group === group);
            if (!grouped.length) return null;
            return (
              <VStack gap="sm" key={group}>
                <Text variant="heading">{group}</Text>
                {grouped.map((notification) => (
                  <Pressable
                    accessibilityLabel={`${notification.actor.name} ${notification.message}`}
                    accessibilityRole="button"
                    key={notification.id}
                    onPress={() => onSelect?.(notification)}
                    testID={`notification-${notification.id}`}
                  >
                    <Card className={`p-4 ${notification.unread ? 'border-primary' : ''}`} variant={notification.unread ? 'raised' : 'outlined'}>
                      <HStack align="start" gap="md">
                        <Avatar fallback={notification.actor.fallback} source={{ uri: notification.actor.avatarUri }} />
                        <VStack className="min-w-0 flex-1" gap="xs">
                          <HStack gap="sm" justify="between">
                            <Text className="min-w-0 flex-1" variant="label">{notification.actor.name}</Text>
                            {notification.unread ? <Badge>New</Badge> : null}
                          </HStack>
                          <Text tone="muted" variant="caption">{notification.message}</Text>
                          <Text tone="subtle" variant="caption">{notification.timestamp}</Text>
                          {notification.unread ? (
                            <Button
                              className="self-start"
                              onPress={(event) => {
                                event?.stopPropagation?.();
                                onMarkRead?.(notification);
                              }}
                              size="sm"
                              testID={`mark-read-${notification.id}`}
                              variant="ghost"
                            >
                              Mark read
                            </Button>
                          ) : null}
                        </VStack>
                      </HStack>
                    </Card>
                  </Pressable>
                ))}
              </VStack>
            );
          })}
        </VStack>
      )}
    </PatternScreen>
  );
}
