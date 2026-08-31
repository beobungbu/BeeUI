import { Avatar, Button, Card, EmptyState, HStack, Skeleton, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import type { SocialPost } from '../fixtures/social-fixtures';
import { people, posts } from '../fixtures/social-fixtures';
import { PatternScreen } from '../components/screen-shell';
import { PostCard } from '../components/post-card';

export type SocialFeedMode = 'populated' | 'loading' | 'empty';

export type SocialFeedScreenProps = {
  mode?: SocialFeedMode;
  onComment?: (post: SocialPost) => void;
  onCompose?: () => void;
  onLike?: (post: SocialPost) => void;
  onPostOpen?: (post: SocialPost) => void;
  onShare?: (post: SocialPost) => void;
};

export function SocialFeedScreen({ mode = 'populated', onComment, onCompose, onLike, onPostOpen, onShare }: SocialFeedScreenProps) {
  return (
    <PatternScreen description="A readable, image-forward community surface with engagement secondary to the content." eyebrow="Community" testID="social-feed-screen" title="Good things people are making">
      <Card className="p-4" variant="muted">
        <HStack gap="md">
          <Avatar fallback={people[3]!.fallback} source={{ uri: people[3]!.avatarUri }} />
          <Button className="flex-1" onPress={onCompose} testID="social-compose" variant="outline">Share something...</Button>
        </HStack>
      </Card>

      {mode === 'loading' ? (
        <VStack gap="md" testID="social-feed-loading">
          {[0, 1].map((item) => (
            <Card className="gap-4 p-4" key={item}>
              <HStack gap="sm"><Skeleton className="h-10 w-10 rounded-full" /><VStack className="flex-1" gap="xs"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-1/4" /></VStack></HStack>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </Card>
          ))}
        </VStack>
      ) : mode === 'empty' ? (
        <EmptyState action={<Button onPress={onCompose}>Create the first post</Button>} description="Follow creators or share an update to start shaping this feed." testID="social-feed-empty" title="Your feed is quiet for now" />
      ) : (
        <VStack gap="md" testID="social-feed-populated">
          {posts.map((post) => <PostCard key={post.id} onComment={onComment} onLike={onLike} onOpen={onPostOpen} onShare={onShare} post={post} />)}
          <Text className="text-center py-2" tone="subtle" variant="caption">You are all caught up.</Text>
        </VStack>
      )}
    </PatternScreen>
  );
}
