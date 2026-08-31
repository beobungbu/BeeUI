import { Avatar, Button, Card, HStack, Input, Separator, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import type { SocialPost } from '../fixtures/social-fixtures';
import { comments, posts } from '../fixtures/social-fixtures';
import { PatternScreen } from '../components/screen-shell';
import { PostCard } from '../components/post-card';

export type PostDetailScreenProps = {
  onCommentSubmit?: (value: string) => void;
  onLike?: (post: SocialPost) => void;
  onShare?: (post: SocialPost) => void;
  post?: SocialPost;
};

export function PostDetailScreen({ onCommentSubmit, onLike, onShare, post = posts[0]! }: PostDetailScreenProps) {
  const [draft, setDraft] = React.useState('');

  const submit = () => {
    const value = draft.trim();
    if (!value) return;
    onCommentSubmit?.(value);
    setDraft('');
  };

  return (
    <PatternScreen description={`${post.author.handle} · ${post.timestamp}`} eyebrow="Post" testID="post-detail-screen" title="Conversation">
      <PostCard onLike={onLike} onShare={onShare} post={post} />

      <VStack gap="md">
        <Text variant="heading">Comments · {comments.length}</Text>
        <Card className="gap-3 p-4" variant="muted">
          <Input accessibilityLabel="Write a comment" onChangeText={setDraft} placeholder="Add to the conversation" value={draft} />
          <Button disabled={!draft.trim()} onPress={submit} testID="comment-submit">Post comment</Button>
        </Card>
        {comments.map((comment, index) => (
          <React.Fragment key={comment.id}>
            <HStack align="start" gap="md">
              <Avatar fallback={comment.author.fallback} size="sm" source={{ uri: comment.author.avatarUri }} />
              <VStack className="min-w-0 flex-1" gap="xs">
                <HStack gap="sm" justify="between">
                  <Text className="min-w-0 flex-1" numberOfLines={1} variant="label">{comment.author.name}</Text>
                  <Text tone="subtle" variant="caption">{comment.timestamp}</Text>
                </HStack>
                <Text>{comment.body}</Text>
                <Button className="self-start" size="sm" variant="ghost">Reply</Button>
              </VStack>
            </HStack>
            {index < comments.length - 1 ? <Separator /> : null}
          </React.Fragment>
        ))}
      </VStack>
    </PatternScreen>
  );
}
