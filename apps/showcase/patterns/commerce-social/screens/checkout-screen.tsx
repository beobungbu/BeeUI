import { AlertBanner, Button, Checkbox, HStack, Radio, RadioGroup, Separator, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { cartItems, formatPrice } from '../fixtures/commerce-fixtures';
import { CheckoutSection } from '../components/checkout-section';
import { PatternScreen } from '../components/screen-shell';

export type CheckoutStatus = 'normal' | 'processing' | 'problem';

export type CheckoutScreenProps = {
  onEditAddress?: () => void;
  onPlaceOrder?: () => void;
  status?: CheckoutStatus;
};

export function CheckoutScreen({ onEditAddress, onPlaceOrder, status = 'normal' }: CheckoutScreenProps) {
  const [delivery, setDelivery] = React.useState('standard');
  const [payment, setPayment] = React.useState('visa');
  const [accepted, setAccepted] = React.useState(true);
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryPrice = delivery === 'express' ? 18 : 0;
  const total = subtotal + deliveryPrice;
  const processing = status === 'processing';

  return (
    <PatternScreen description="A calm, reviewable checkout that keeps integrations behind callbacks." eyebrow="Checkout" testID="checkout-screen" title="Almost yours">
      <VStack gap="md">
        {status === 'problem' ? (
          <AlertBanner description="We could not validate the selected payment method. Choose another method or try again." testID="checkout-problem" title="Payment needs attention" variant="destructive" />
        ) : null}

        <CheckoutSection description="Where this order will be delivered." title="Delivery address">
          <HStack align="start" gap="md" justify="between">
            <VStack className="min-w-0 flex-1" gap="xs">
              <Text variant="label">Alex Morgan</Text>
              <Text tone="muted" variant="caption">28 Market Street · District 2{`\n`}Ho Chi Minh City</Text>
            </VStack>
            <Button onPress={onEditAddress} size="sm" variant="ghost">Edit</Button>
          </HStack>
        </CheckoutSection>

        <CheckoutSection description="Choose a speed without hiding the cost." title="Delivery method">
          <RadioGroup onValueChange={setDelivery} value={delivery}>
            <Radio label="Standard · 2–4 days · Free" value="standard" />
            <Radio label="Express · Next day · $18.00" value="express" />
          </RadioGroup>
        </CheckoutSection>

        <CheckoutSection description="Payment SDK ownership stays outside this pattern." title="Payment method">
          <RadioGroup onValueChange={setPayment} value={payment}>
            <Radio label="Visa •••• 4242" value="visa" />
            <Radio label="Apple Pay" value="apple-pay" />
          </RadioGroup>
        </CheckoutSection>

        <CheckoutSection title="Order summary">
          {cartItems.map((item) => (
            <HStack gap="sm" justify="between" key={item.id}>
              <Text className="min-w-0 flex-1" numberOfLines={1} tone="muted">{item.quantity} × {item.product.name}</Text>
              <Text>{formatPrice(item.product.price * item.quantity)}</Text>
            </HStack>
          ))}
          <Separator />
          <HStack justify="between"><Text tone="muted">Delivery</Text><Text>{deliveryPrice ? formatPrice(deliveryPrice) : 'Free'}</Text></HStack>
          <HStack justify="between"><Text variant="heading">Total</Text><Text variant="heading">{formatPrice(total)}</Text></HStack>
        </CheckoutSection>

        <Checkbox checked={accepted} label="I confirm the order details and agree to the purchase terms." onCheckedChange={setAccepted} />
        <Button disabled={!accepted || processing} loading={processing} onPress={onPlaceOrder} testID="checkout-place-order">
          {processing ? 'Placing order' : `Place order · ${formatPrice(total)}`}
        </Button>
      </VStack>
    </PatternScreen>
  );
}
