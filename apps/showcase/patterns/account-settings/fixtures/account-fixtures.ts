export type AccountProfileFixture = {
  bio: string;
  displayName: string;
  email: string;
  imageUri?: string;
  joinedLabel: string;
  location: string;
  phone: string;
  username: string;
  verified: boolean;
};

export const accountProfileFixture: AccountProfileFixture = {
  bio: 'Product-minded engineer building calm, useful software experiences.',
  displayName: 'Lan Tran',
  email: 'lan@example.com',
  joinedLabel: 'Member since 2024',
  location: 'Ho Chi Minh City, Vietnam',
  phone: '+84 90 123 4567',
  username: 'lantran',
  verified: true,
};

export const settingsSummaryFixture = {
  appearance: 'system' as const,
  notificationCount: 2,
  notificationsEnabled: true,
};

export const profileStatsFixture = [
  { label: 'Projects', value: '12' },
  { label: 'Following', value: '248' },
  { label: 'Saved', value: '36' },
] as const;

export const recentProfileActivityFixture = [
  { description: 'Your public profile details were updated.', title: 'Profile refreshed', value: 'Today' },
  { description: 'A new Mac signed in successfully.', title: 'New sign-in', value: '2d' },
] as const;
