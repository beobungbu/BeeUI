export type SocialUser = {
  id: string;
  name: string;
  handle: string;
  avatarUri: string;
  fallback: string;
  bio: string;
};

export type SocialPost = {
  id: string;
  author: SocialUser;
  body: string;
  imageUri?: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  liked?: boolean;
};

export type SocialComment = {
  id: string;
  author: SocialUser;
  body: string;
  timestamp: string;
};

export type SocialNotification = {
  id: string;
  actor: SocialUser;
  message: string;
  timestamp: string;
  group: 'Today' | 'Earlier';
  unread: boolean;
};

export type Conversation = {
  id: string;
  user: SocialUser;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
};

export const people: SocialUser[] = [
  {
    id: 'u-maya',
    name: 'Maya Chen',
    handle: '@mayamakes',
    avatarUri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80',
    fallback: 'MC',
    bio: 'Objects, spaces, and small rituals. Product designer in Singapore.',
  },
  {
    id: 'u-noah',
    name: 'Noah Williams',
    handle: '@noahwalks',
    avatarUri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
    fallback: 'NW',
    bio: 'Street photography, coffee, and very long walks.',
  },
  {
    id: 'u-ana',
    name: 'Ana Ribeiro',
    handle: '@anaribeiro',
    avatarUri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80',
    fallback: 'AR',
    bio: 'Ceramics and slow interiors from Lisbon.',
  },
  {
    id: 'u-you',
    name: 'Alex Morgan',
    handle: '@alexmorgan',
    avatarUri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80',
    fallback: 'AM',
    bio: 'Collecting useful things and better ideas.',
  },
];

export const posts: SocialPost[] = [
  {
    id: 'post-1',
    author: people[0]!,
    body: 'A tiny reset for the studio: fewer objects on the desk, warmer light, and one notebook that actually gets used.',
    imageUri: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1000&q=80',
    timestamp: '18 min',
    likes: 128,
    comments: 18,
    shares: 7,
    liked: true,
  },
  {
    id: 'post-2',
    author: people[1]!,
    body: 'Found the quietest corner of the city just before the rain. The reflections did all the work.',
    imageUri: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1000&q=80',
    timestamp: '1 hr',
    likes: 342,
    comments: 31,
    shares: 26,
  },
  {
    id: 'post-3',
    author: people[2]!,
    body: 'Kiln day. These little cups came out more mossy than planned, which is exactly why I love them.',
    timestamp: '3 hr',
    likes: 94,
    comments: 12,
    shares: 4,
  },
];

export const comments: SocialComment[] = [
  { id: 'comment-1', author: people[2]!, body: 'The warmer lamp makes such a difference. Beautiful space.', timestamp: '12 min' },
  { id: 'comment-2', author: people[1]!, body: 'One notebook is the real productivity system.', timestamp: '8 min' },
  { id: 'comment-3', author: people[3]!, body: 'Saving this for my weekend reset.', timestamp: '2 min' },
];

export const notifications: SocialNotification[] = [
  { id: 'notification-1', actor: people[0]!, message: 'liked your collection “Soft utility”.', timestamp: '4 min', group: 'Today', unread: true },
  { id: 'notification-2', actor: people[1]!, message: 'started following you.', timestamp: '28 min', group: 'Today', unread: true },
  { id: 'notification-3', actor: people[2]!, message: 'replied to your comment: “Exactly this.”', timestamp: '2 hr', group: 'Today', unread: false },
  { id: 'notification-4', actor: people[0]!, message: 'mentioned you in a post.', timestamp: 'Yesterday', group: 'Earlier', unread: false },
];

export const conversations: Conversation[] = [
  { id: 'conversation-1', user: people[0]!, lastMessage: 'I sent the references over — the second one is closest.', timestamp: '09:42', unreadCount: 2 },
  { id: 'conversation-2', user: people[1]!, lastMessage: 'Perfect. Saturday morning works for me.', timestamp: 'Yesterday', unreadCount: 0 },
  { id: 'conversation-3', user: people[2]!, lastMessage: 'Thank you! I can reserve the moss pair for you.', timestamp: 'Mon', unreadCount: 1 },
];
