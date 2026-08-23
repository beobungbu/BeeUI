export type Product = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  imageUri: string;
  badge?: string;
  description: string;
  availability: string;
  shipping: string;
  variants: string[];
};

export type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  variant: string;
};

export type OrderStatus = 'Processing' | 'Shipped' | 'Delivered';

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  date: string;
  total: number;
  itemCount: number;
  items: CartItem[];
  shippingAddress: string;
  paymentMethod: string;
  history: Array<{ title: string; description: string; meta: string; status: 'default' | 'primary' | 'success' }>;
};

export const products: Product[] = [
  {
    id: 'p-aurora-tote',
    name: 'Aurora Soft Tote',
    subtitle: 'Italian pebbled leather',
    category: 'Bags',
    price: 168,
    originalPrice: 210,
    rating: 4.9,
    reviewCount: 184,
    imageUri: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80',
    badge: 'Editor pick',
    description: 'A softly structured everyday tote with a wide opening, reinforced base and room for a 13-inch laptop.',
    availability: 'In stock · ships in 1–2 days',
    shipping: 'Free standard delivery and 30-day returns',
    variants: ['Sand', 'Espresso', 'Black'],
  },
  {
    id: 'p-cloud-runner',
    name: 'Cloudline Runner',
    subtitle: 'Lightweight daily sneaker',
    category: 'Shoes',
    price: 124,
    rating: 4.8,
    reviewCount: 96,
    imageUri: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
    badge: 'New',
    description: 'Breathable knit runners tuned for long city days, with a responsive foam midsole and grippy rubber outsole.',
    availability: 'Low stock in selected sizes',
    shipping: 'Free standard delivery over $100',
    variants: ['US 7', 'US 8', 'US 9', 'US 10'],
  },
  {
    id: 'p-studio-watch',
    name: 'Studio Field Watch',
    subtitle: 'Brushed steel · 38 mm',
    category: 'Accessories',
    price: 198,
    originalPrice: 240,
    rating: 4.7,
    reviewCount: 71,
    imageUri: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
    description: 'A compact field watch with a quiet dial, sapphire glass and interchangeable woven strap.',
    availability: 'In stock',
    shipping: 'Complimentary tracked delivery',
    variants: ['Olive', 'Navy', 'Stone'],
  },
  {
    id: 'p-arc-headphones',
    name: 'Arc Studio Headphones',
    subtitle: 'Wireless over-ear audio',
    category: 'Tech',
    price: 149,
    rating: 4.6,
    reviewCount: 238,
    imageUri: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
    badge: 'Popular',
    description: 'Balanced wireless headphones with plush memory foam cushions, multipoint pairing and 40-hour battery life.',
    availability: 'Ready to ship',
    shipping: 'Free delivery and easy exchanges',
    variants: ['Graphite', 'Bone'],
  },
  {
    id: 'p-linen-shirt',
    name: 'Washed Linen Overshirt',
    subtitle: 'Relaxed Portuguese linen',
    category: 'Apparel',
    price: 92,
    rating: 4.9,
    reviewCount: 52,
    imageUri: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
    description: 'A breathable layer with a softly washed hand feel, dropped shoulders and corozo buttons.',
    availability: 'In stock',
    shipping: 'Ships next business day',
    variants: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'p-ceramic-set',
    name: 'Quiet Morning Cup Set',
    subtitle: 'Hand-glazed stoneware · pair',
    category: 'Home',
    price: 58,
    rating: 4.8,
    reviewCount: 43,
    imageUri: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80',
    badge: 'Small batch',
    description: 'Two softly irregular stoneware cups made for slow coffee, glazed by hand so each pair is subtly unique.',
    availability: 'Only 8 sets left',
    shipping: 'Packed plastic-free with tracked shipping',
    variants: ['Chalk', 'Moss'],
  },
];

export const cartItems: CartItem[] = [
  { id: 'cart-1', product: products[0]!, quantity: 1, variant: 'Espresso' },
  { id: 'cart-2', product: products[1]!, quantity: 2, variant: 'US 9' },
];

export const orders: Order[] = [
  {
    id: 'order-1048',
    number: '#1048',
    status: 'Shipped',
    date: 'Aug 21, 2026',
    total: 416,
    itemCount: 3,
    items: cartItems,
    shippingAddress: '28 Market Street · District 2 · Ho Chi Minh City',
    paymentMethod: 'Visa •••• 4242',
    history: [
      { title: 'Order confirmed', description: 'Payment captured and inventory reserved.', meta: 'Aug 21 · 09:18', status: 'success' },
      { title: 'Packed with care', description: 'Your items passed final quality inspection.', meta: 'Aug 21 · 16:42', status: 'success' },
      { title: 'In transit', description: 'Courier has your parcel. Estimated delivery tomorrow.', meta: 'Aug 22 · 08:10', status: 'primary' },
    ],
  },
  {
    id: 'order-1037',
    number: '#1037',
    status: 'Delivered',
    date: 'Aug 08, 2026',
    total: 198,
    itemCount: 1,
    items: [{ id: 'cart-3', product: products[2]!, quantity: 1, variant: 'Olive' }],
    shippingAddress: '28 Market Street · District 2 · Ho Chi Minh City',
    paymentMethod: 'Apple Pay',
    history: [
      { title: 'Order confirmed', description: 'Payment captured.', meta: 'Aug 08 · 10:01', status: 'success' },
      { title: 'Delivered', description: 'Left with reception.', meta: 'Aug 10 · 14:22', status: 'success' },
    ],
  },
  {
    id: 'order-1052',
    number: '#1052',
    status: 'Processing',
    date: 'Aug 23, 2026',
    total: 92,
    itemCount: 1,
    items: [{ id: 'cart-4', product: products[4]!, quantity: 1, variant: 'M' }],
    shippingAddress: '28 Market Street · District 2 · Ho Chi Minh City',
    paymentMethod: 'Visa •••• 4242',
    history: [
      { title: 'Order confirmed', description: 'We are preparing your order.', meta: 'Today · 08:12', status: 'primary' },
    ],
  },
];

export const formatPrice = (value: number) => `$${value.toFixed(2)}`;
