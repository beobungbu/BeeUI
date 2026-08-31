import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fireEvent, render } from '@testing-library/react-native';
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
} from '../../patterns/commerce-social';

const screens = [
  ProductFeedScreen,
  ProductSearchScreen,
  ProductDetailScreen,
  CartScreen,
  CheckoutScreen,
  OrdersScreen,
  OrderDetailScreen,
  SocialFeedScreen,
  PostDetailScreen,
  NotificationsScreen,
  UserProfileScreen,
  MessagesScreen,
];

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

const productA = {
  id: 'product-a',
  name: 'Product A',
  subtitle: 'Variant identity fixture',
  category: 'Test',
  price: 100,
  rating: 4.8,
  reviewCount: 12,
  imageUri: 'https://example.com/product-a.jpg',
  description: 'A deterministic product used to verify variant state.',
  availability: 'In stock',
  shipping: 'Ships today',
  variants: ['S', 'M', 'L'],
};

const productB = {
  ...productA,
  id: 'product-b',
  name: 'Product B',
  variants: ['Blue', 'Green'],
};

function expectChecked(view: ReturnType<typeof render>, name: string) {
  expect(view.getByRole('radio', { name }).props.accessibilityState).toEqual(
    expect.objectContaining({ checked: true }),
  );
}

describe('commerce + social production patterns', () => {
  it('typechecks the isolated pattern project', () => {
    execFileSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'tsc', '-p', 'patterns/commerce-social/tsconfig.json', '--noEmit'],
      {
        cwd: path.resolve(__dirname, '../..'),
        env: process.env,
        stdio: 'inherit',
      },
    );
  });

  it('exports all 12 production screens', () => {
    expect(screens).toHaveLength(12);
    screens.forEach((screen) => expect(typeof screen).toBe('function'));
  });

  it('wires product selection and favorite callbacks', () => {
    const onProductSelect = jest.fn();
    const onFavorite = jest.fn();
    const view = render(<ProductFeedScreen onFavorite={onFavorite} onProductSelect={onProductSelect} />);

    fireEvent.press(view.getByTestId('product-card-p-cloud-runner'));
    fireEvent.press(view.getByTestId('favorite-p-cloud-runner'));

    expect(onProductSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-cloud-runner' }));
    expect(onFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-cloud-runner' }));
  });

  it('filters product search results from the visible query', () => {
    const view = render(<ProductSearchScreen initialQuery="linen" />);

    expect(view.getByText('1 match')).toBeTruthy();
    expect(view.getByText('Washed Linen Overshirt')).toBeTruthy();

    fireEvent.changeText(view.getByPlaceholderText('Search the collection'), 'no such product');
    expect(view.getByTestId('product-search-empty')).toBeTruthy();
  });

  it('wires product-detail add-to-cart and favorite callbacks', () => {
    const onAddToCart = jest.fn();
    const onFavorite = jest.fn();
    const view = render(<ProductDetailScreen onAddToCart={onAddToCart} onFavorite={onFavorite} />);

    fireEvent.press(view.getByTestId('product-detail-favorite'));
    fireEvent.press(view.getByTestId('product-detail-add'));

    expect(onFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-aurora-tote' }));
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-aurora-tote' }), 'Sand');
  });

  it('preserves variant selection for a newly allocated object with the same logical product id', () => {
    const view = render(<ProductDetailScreen product={productA} />);

    fireEvent.press(view.getByRole('radio', { name: 'M' }));
    expectChecked(view, 'M');

    view.rerender(<ProductDetailScreen product={{ ...productA, variants: [...productA.variants] }} />);
    expectChecked(view, 'M');

    view.rerender(<ProductDetailScreen product={productB} />);
    expectChecked(view, 'Blue');
  });

  it('falls back to a valid variant when the current option disappears', () => {
    const view = render(<ProductDetailScreen product={productA} />);

    fireEvent.press(view.getByRole('radio', { name: 'M' }));
    expectChecked(view, 'M');

    view.rerender(<ProductDetailScreen product={{ ...productA, variants: ['S', 'L'] }} />);

    expect(view.queryByRole('radio', { name: 'M' })).toBeNull();
    expectChecked(view, 'S');
  });

  it('renders an unavailable CTA when a product has no variants', () => {
    const view = render(<ProductDetailScreen product={{ ...productA, variants: [] }} />);

    expect(view.getByText('No options are currently available.')).toBeTruthy();
    expect(view.getByTestId('product-detail-add').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('wires cart quantity and remove callbacks', () => {
    const onQuantityChange = jest.fn();
    const onRemove = jest.fn();
    const view = render(<CartScreen onQuantityChange={onQuantityChange} onRemove={onRemove} />);

    fireEvent.press(view.getAllByTestId('quantity-increase')[0]!);
    fireEvent.press(view.getByTestId('remove-cart-1'));

    expect(onQuantityChange).toHaveBeenCalledWith('cart-1', 2);
    expect(onRemove).toHaveBeenCalledWith('cart-1');
  });

  it('wires checkout and order selection callbacks', () => {
    const onPlaceOrder = jest.fn();
    const checkout = render(<CheckoutScreen onPlaceOrder={onPlaceOrder} />);
    fireEvent.press(checkout.getByTestId('checkout-place-order'));
    expect(onPlaceOrder).toHaveBeenCalledTimes(1);
    checkout.unmount();

    const onOrderSelect = jest.fn();
    const orderList = render(<OrdersScreen onOrderSelect={onOrderSelect} />);
    fireEvent.press(orderList.getByTestId('order-order-1048'));
    expect(onOrderSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1048' }));
  });

  it('wires feed engagement actions', () => {
    const onLike = jest.fn();
    const onComment = jest.fn();
    const onShare = jest.fn();
    const view = render(<SocialFeedScreen onComment={onComment} onLike={onLike} onShare={onShare} />);

    fireEvent.press(view.getByTestId('like-post-1'));
    fireEvent.press(view.getByTestId('comment-post-1'));
    fireEvent.press(view.getByTestId('share-post-1'));

    expect(onLike).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1' }));
    expect(onComment).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1' }));
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1' }));
  });

  it('wires follow and own-profile edit actions', () => {
    const onFollow = jest.fn();
    const profile = render(<UserProfileScreen onFollow={onFollow} />);
    fireEvent.press(profile.getByTestId('profile-follow'));
    expect(onFollow).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-maya' }));
    profile.unmount();

    const onEdit = jest.fn();
    const ownProfile = render(<UserProfileScreen isOwnProfile onEdit={onEdit} />);
    fireEvent.press(ownProfile.getByTestId('profile-edit'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-maya' }));
  });

  it('wires notification and conversation actions', () => {
    const onSelect = jest.fn();
    const onMarkRead = jest.fn();
    const activity = render(<NotificationsScreen onMarkRead={onMarkRead} onSelect={onSelect} />);
    fireEvent.press(activity.getByTestId('notification-notification-1'));
    fireEvent.press(activity.getByTestId('mark-read-notification-1'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'notification-1' }));
    expect(onMarkRead).toHaveBeenCalledWith(expect.objectContaining({ id: 'notification-1' }));
    activity.unmount();

    const onConversationSelect = jest.fn();
    const messages = render(<MessagesScreen onConversationSelect={onConversationSelect} />);
    fireEvent.press(messages.getByTestId('conversation-conversation-1'));
    expect(onConversationSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'conversation-1' }));
  });

  it('renders representative loading, empty, processing, and problem states', () => {
    const feed = render(<ProductFeedScreen loading />);
    expect(feed.getByTestId('product-feed-loading')).toBeTruthy();
    feed.unmount();

    const search = render(<ProductSearchScreen mode="empty" />);
    expect(search.getByTestId('product-search-empty')).toBeTruthy();
    search.unmount();

    const cart = render(<CartScreen empty />);
    expect(cart.getByTestId('cart-empty')).toBeTruthy();
    cart.unmount();

    const checkout = render(<CheckoutScreen status="problem" />);
    expect(checkout.getByTestId('checkout-problem')).toBeTruthy();
    checkout.unmount();

    const processingCheckout = render(<CheckoutScreen status="processing" />);
    expect(processingCheckout.getByTestId('checkout-place-order').props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );
    processingCheckout.unmount();

    const orderList = render(<OrdersScreen empty />);
    expect(orderList.getByTestId('orders-empty')).toBeTruthy();
    orderList.unmount();

    const feedEmpty = render(<SocialFeedScreen mode="empty" />);
    expect(feedEmpty.getByTestId('social-feed-empty')).toBeTruthy();
    feedEmpty.unmount();

    const notifications = render(<NotificationsScreen empty />);
    expect(notifications.getByTestId('notifications-empty')).toBeTruthy();
    notifications.unmount();

    const messages = render(<MessagesScreen empty />);
    expect(messages.getByTestId('messages-empty')).toBeTruthy();
  });

  it('uses no router and only the public BeeUI package entrypoint', () => {
    const root = path.resolve(__dirname, '../../patterns/commerce-social');
    const source = sourceFiles(root).map((file) => fs.readFileSync(file, 'utf8')).join('\n');

    expect(source).not.toMatch(/from ['"]@beemvp\/beeui-ui\//);
    expect(source).not.toMatch(/from ['"](?:expo-router|@react-navigation|react-router)/);
  });
});
