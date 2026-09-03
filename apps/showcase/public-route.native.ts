import { Linking } from 'react-native';
import type { PublicShowcaseRoute } from './public-route-core';

export function getPublicShowcaseRoute(): PublicShowcaseRoute {
  return { embed: false };
}

export function navigatePublicPath(path: string) {
  void Linking.openURL(`https://beeui.beemvp.com${path}`);
}
