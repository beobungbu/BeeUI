import { BackHandler, Platform } from 'react-native';
import type { OverlayDismissReason } from '../../lib/beeui/core/index';

export type OverlayPlatformDismissHandler = (reason: OverlayDismissReason) => boolean;

export function subscribeOverlayPlatformDismiss(handler: OverlayPlatformDismissHandler) {
  if (Platform.OS !== 'android') return () => undefined;

  const subscription = BackHandler.addEventListener('hardwareBackPress', () => handler('back'));
  return () => subscription.remove();
}
