import { useToast } from '@beeui/ui';
import * as React from 'react';
import {
  CartScreen,
  CheckoutScreen,
  MessagesScreen,
  NotificationsScreen,
  OrderDetailScreen,
  OrdersScreen,
  PostDetailScreen,
  ProductDetailScreen,
  ProductFeedScreen,
  ProductSearchScreen,
  SocialFeedScreen,
  UserProfileScreen,
  cartItems,
} from '../../patterns/commerce-social';
import type { PatternDemoProps, PatternDomain } from '../types';

function ProductFeedDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  return (
    <ProductFeedScreen
      loading={stateId === 'loading'}
      onFavorite={() => toast.show({ title: 'Favorite toggled' })}
      onProductSelect={() => toast.show({ title: 'Product selected' })}
    />
  );
}

function ProductSearchDemo({ stateId }: PatternDemoProps) {
  return <ProductSearchScreen initialQuery="linen" mode={stateId === 'empty' ? 'empty' : undefined} />;
}

function ProductDetailDemo() {
  const toast = useToast();
  return (
    <ProductDetailScreen
      onAddToCart={() => toast.show({ title: 'Added to cart', variant: 'success' })}
      onFavorite={() => toast.show({ title: 'Favorite toggled' })}
    />
  );
}

function CartDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [items, setItems] = React.useState(() => cartItems.map((item) => ({ ...item })));

  return (
    <CartScreen
      empty={stateId === 'empty'}
      items={items}
      onCheckout={() => toast.show({ title: 'Continue to checkout' })}
      onQuantityChange={(itemId, quantity) => {
        setItems((current) => current.map((item) => item.id === itemId ? { ...item, quantity } : item));
      }}
      onRemove={(itemId) => {
        setItems((current) => current.filter((item) => item.id !== itemId));
        toast.show({ title: 'Item removed' });
      }}
    />
  );
}

function CheckoutDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const status = stateId === 'processing' ? 'processing' : stateId === 'problem' ? 'problem' : undefined;
  return (
    <CheckoutScreen
      onPlaceOrder={() => toast.show({ title: 'Order placed', variant: 'success' })}
      status={status}
    />
  );
}

function OrdersDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  return (
    <OrdersScreen
      empty={stateId === 'empty'}
      onOrderSelect={() => toast.show({ title: 'Order selected' })}
    />
  );
}

function OrderDetailDemo() {
  return <OrderDetailScreen />;
}

function SocialFeedDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  return (
    <SocialFeedScreen
      mode={stateId === 'empty' ? 'empty' : undefined}
      onComment={() => toast.show({ title: 'Comment action' })}
      onLike={() => toast.show({ title: 'Like toggled' })}
      onShare={() => toast.show({ title: 'Share post' })}
    />
  );
}

function PostDetailDemo() {
  return <PostDetailScreen />;
}

function NotificationsDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  return (
    <NotificationsScreen
      empty={stateId === 'empty'}
      onMarkRead={() => toast.show({ title: 'Marked as read', variant: 'success' })}
      onSelect={() => toast.show({ title: 'Notification selected' })}
    />
  );
}

function UserProfileDemo() {
  const toast = useToast();
  return (
    <UserProfileScreen
      onEdit={() => toast.show({ title: 'Edit profile' })}
      onFollow={() => toast.show({ title: 'Follow toggled' })}
    />
  );
}

function MessagesDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  return (
    <MessagesScreen
      empty={stateId === 'empty'}
      onConversationSelect={() => toast.show({ title: 'Conversation selected' })}
    />
  );
}

export const commerceSocialPatternDomain: PatternDomain = {
  id: 'commerce-social',
  title: 'Commerce & Social',
  description: 'Product discovery, cart and checkout, orders, feeds, notifications, profiles, and messaging.',
  screens: [
    {
      id: 'product-feed',
      title: 'Product Feed',
      description: 'Browsable product collection with favorite and selection actions.',
      source: ProductFeedScreen,
      component: ProductFeedDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'loading', title: 'Loading' },
      ],
    },
    {
      id: 'product-search',
      title: 'Product Search',
      description: 'Interactive collection search with empty-state coverage.',
      source: ProductSearchScreen,
      component: ProductSearchDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'empty', title: 'Empty' },
      ],
    },
    { id: 'product-detail', title: 'Product Detail', description: 'Product media, variants, pricing, favorite, and cart action.', source: ProductDetailScreen, component: ProductDetailDemo },
    {
      id: 'cart',
      title: 'Cart',
      description: 'Locally controlled quantities, remove actions, and order summary.',
      source: CartScreen,
      component: CartDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'empty', title: 'Empty' },
      ],
    },
    {
      id: 'checkout',
      title: 'Checkout',
      description: 'Checkout summary with processing and problem states.',
      source: CheckoutScreen,
      component: CheckoutDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'processing', title: 'Processing' },
        { id: 'problem', title: 'Problem' },
      ],
    },
    {
      id: 'orders',
      title: 'Orders',
      description: 'Order history and selection actions.',
      source: OrdersScreen,
      component: OrdersDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'empty', title: 'Empty' },
      ],
    },
    { id: 'order-detail', title: 'Order Detail', description: 'Order status, items, totals, and delivery details.', source: OrderDetailScreen, component: OrderDetailDemo },
    {
      id: 'social-feed',
      title: 'Social Feed',
      description: 'Post stream with like, comment, and share actions.',
      source: SocialFeedScreen,
      component: SocialFeedDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'empty', title: 'Empty' },
      ],
    },
    { id: 'post-detail', title: 'Post Detail', description: 'Focused post with discussion context.', source: PostDetailScreen, component: PostDetailDemo },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Activity stream with read and selection actions.',
      source: NotificationsScreen,
      component: NotificationsDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'empty', title: 'Empty' },
      ],
    },
    { id: 'user-profile', title: 'User Profile', description: 'Public profile, social stats, and follow/edit actions.', source: UserProfileScreen, component: UserProfileDemo },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Conversation list and empty-state messaging.',
      source: MessagesScreen,
      component: MessagesDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'empty', title: 'Empty' },
      ],
    },
  ],
};
