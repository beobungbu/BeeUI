import { EmptyState, SearchInput, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import type { Conversation } from '../fixtures/social-fixtures';
import { conversations } from '../fixtures/social-fixtures';
import { MessageRow } from '../components/message-row';
import { PatternScreen } from '../components/screen-shell';

export type MessagesScreenProps = {
  empty?: boolean;
  onConversationSelect?: (conversation: Conversation) => void;
};

export function MessagesScreen({ empty = false, onConversationSelect }: MessagesScreenProps) {
  const [query, setQuery] = React.useState('');
  const normalized = query.trim().toLowerCase();
  const visible = empty ? [] : conversations.filter((conversation) =>
    !normalized || conversation.user.name.toLowerCase().includes(normalized) || conversation.lastMessage.toLowerCase().includes(normalized),
  );

  return (
    <PatternScreen description="Recent conversations stay scannable even when names and message previews run long." eyebrow="Inbox" testID="messages-screen" title="Messages">
      <SearchInput accessibilityLabel="Search conversations" onChangeText={setQuery} placeholder="Search people or messages" value={query} />
      {visible.length === 0 ? (
        <EmptyState
          description={query ? `No conversations matched “${query}”.` : 'Start a conversation from a profile and it will appear here.'}
          testID="messages-empty"
          title={query ? 'No matching conversations' : 'Your inbox is clear'}
        />
      ) : (
        <VStack gap="sm" testID="messages-active">
          <Text tone="muted" variant="caption">{visible.length} recent conversations</Text>
          {visible.map((conversation) => <MessageRow conversation={conversation} key={conversation.id} onSelect={onConversationSelect} />)}
        </VStack>
      )}
    </PatternScreen>
  );
}
