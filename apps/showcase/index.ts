import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
// Spike branch: root points at the #35 portal-context reproduction instead of
// the full showcase. Revert to './App' before landing anything.
import App from './SpikeApp';

registerRootComponent(App);
