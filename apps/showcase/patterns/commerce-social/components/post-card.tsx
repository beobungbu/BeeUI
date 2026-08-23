import { Avatar, Button, Card, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { Image } from 'react-native';
import type { SocialPost } from '../fixtures/social-fixtures';

export type PostCardProps = {
  onComment?: (post: SocialPost) => void;
  onLike?: (post: SocialPost) => void;
  onOpen?: (post: SocialPost) => void;
  onShare?: (post: SocialPost) => void;
  post: SocialPost;
};

export function PostCard({ onComment, onLike, onOpen, onShare, post }: PostCardProps) {
  return (
    <Card className="gap-4 p-4" variant="raised" testID={`post-card-${post.id}`}>
      <HStack gap="sm">
        <Avatar accessibilityLabel={post.author.name} fallback={post.author.fallback} source={{ uri: post.author.avatarUri }} />
        <VStack className="min-w-0 flex-1" gap="none">
          <Text numberOfLines={1} variant="label">{post.author.name}</Text>
          <Text numberOfLines={1} tone="muted" variant="caption">{post.author.handle} · {post.timestamp}</Text>
        </VStack>
        <Button onPress={() => onOpen?.(post)} size="sm" variant="ghost">Open</Button>
      </HStack>
      <Text>{post.body}</Text>
      {post.imageUri ? (
        <Card className="overflow-hidden p-0">
          <Image accessible={false} resizeMode="cover" source={{ uri: post.imageUri }} style={{ width: '100%', aspectRatio: 1.45 }} />
        </Card>
      ) : null}
      <HStack gap="xs" justify="between" wrap>
        <Button onPress={() => onLike?.(post)} size="sm" testID={`like-${post.id}`} variant="ghost">{post.liked ? '♥' : '♡'} {post.likes}</Button>
        <Button onPress={() => onComment?.(post)} size="sm" testID={`comment-${post.id}`} variant="ghost">Comment {post.comments}</Button>
        <Button onPress={() => onShare?.(post)} size="sm" testID={`share-${post.id}`} variant="ghost">Share {post.shares}</Button>
      </HStack>
    </Card>
  );
}
