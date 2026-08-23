import { Avatar, Badge, Card, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { Pressable } from 'react-native';
import type { Conversation } from '../fixtures/social-fixtures';

export type MessageRowProps = {
  conversation: Conversation;
  onSelect?: (conversation: Conversation) => void;
};

export function MessageRow({ conversation, onSelect }: MessageRowProps) {
  return (
    <Pressable
      accessibilityLabel={`Conversation with ${conversation.user.name}`}
      accessibilityRole="button"
      onPress={() => onSelect?.(conversation)}
      testID={`conversation-${conversation.id}`}
    >
      <Card className="p-4">
        <HStack align="start" gap="md">
          <Avatar fallback={conversation.user.fallback} source={{ uri: conversation.user.avatarUri }} />
          <VStack className="min-w-0 flex-1" gap="xs">
            <HStack gap="sm" justify="between">
              <Text className="min-w-0 flex-1" numberOfLines={1} variant="label">{conversation.user.name}</Text>
              <Text tone="subtle" variant="caption">{conversation.timestamp}</Text>
            </HStack>
            <HStack gap="sm" justify="between">
              <Text className="min-w-0 flex-1" numberOfLines={1} tone={conversation.unreadCount ? 'default' : 'muted'} variant="caption">{conversation.lastMessage}</Text>
              {conversation.unreadCount ? <Badge>{conversation.unreadCount}</Badge> : null}
            </HStack>
          </VStack>
        </HStack>
      </Card>
    </Pressable>
  );
}
