import { Avatar, Button, Card, EmptyState, HStack, Separator, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import type { SocialPost, SocialUser } from '../fixtures/social-fixtures';
import { people, posts } from '../fixtures/social-fixtures';
import { PatternScreen } from '../components/screen-shell';
import { PostCard } from '../components/post-card';
import { SocialStat } from '../components/social-stat';

export type UserProfileScreenProps = {
  emptyContent?: boolean;
  isOwnProfile?: boolean;
  onEdit?: (user: SocialUser) => void;
  onFollow?: (user: SocialUser) => void;
  onPostOpen?: (post: SocialPost) => void;
  user?: SocialUser;
};

export function UserProfileScreen({ emptyContent = false, isOwnProfile = false, onEdit, onFollow, onPostOpen, user = people[0]! }: UserProfileScreenProps) {
  const userPosts = emptyContent ? [] : posts.filter((post) => post.author.id === user.id);

  return (
    <PatternScreen eyebrow="Profile" testID="user-profile-screen" title={user.name}>
      <VStack align="center" gap="md">
        <Avatar accessibilityLabel={user.name} fallback={user.fallback} size="xl" source={{ uri: user.avatarUri }} />
        <VStack align="center" gap="xs">
          <Text tone="muted" variant="label">{user.handle}</Text>
          <Text className="max-w-md text-center" tone="muted">{user.bio}</Text>
        </VStack>
        <HStack gap="xl">
          <SocialStat label="Posts" value={userPosts.length || 24} />
          <SocialStat label="Followers" value="12.8k" />
          <SocialStat label="Following" value="418" />
        </HStack>
        <Button
          className="min-w-40"
          onPress={() => isOwnProfile ? onEdit?.(user) : onFollow?.(user)}
          testID={isOwnProfile ? 'profile-edit' : 'profile-follow'}
          variant={isOwnProfile ? 'outline' : 'primary'}
        >
          {isOwnProfile ? 'Edit profile' : 'Follow'}
        </Button>
      </VStack>

      <Card className="gap-3 p-4" variant="muted">
        <HStack justify="between"><Text tone="muted" variant="caption">Location</Text><Text variant="caption">Singapore</Text></HStack>
        <Separator />
        <HStack justify="between"><Text tone="muted" variant="caption">Member since</Text><Text variant="caption">2023</Text></HStack>
        <Separator />
        <HStack justify="between"><Text tone="muted" variant="caption">Focus</Text><Text variant="caption">Product · Spaces</Text></HStack>
      </Card>

      <VStack gap="md">
        <Text variant="heading">Recent work</Text>
        {userPosts.length ? userPosts.map((post) => <PostCard key={post.id} onOpen={onPostOpen} post={post} />) : (
          <EmptyState description="Published work and community posts will appear here." testID="profile-content-empty" title="No posts to show" />
        )}
      </VStack>
    </PatternScreen>
  );
}
