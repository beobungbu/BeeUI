import { Platform, UIManager } from 'react-native';
import { resolveOverlayHostMode } from '../../../packages/ui/src/components/overlay-host-mode';

/**
 * The overlay host backend is chosen at runtime. These cases pin that selection
 * for every environment BeeUI ships into.
 */
describe('resolveOverlayHostMode', () => {
  const globalScope = globalThis as { nativeFabricUIManager?: unknown };
  const originalPlatformOS = Platform.OS;
  const originalFabric = globalScope.nativeFabricUIManager;

  function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  }
  function setFabric(enabled: boolean) {
    if (enabled) globalScope.nativeFabricUIManager = {};
    else delete globalScope.nativeFabricUIManager;
  }
  function setHostRegistered(registered: boolean) {
    jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(registered);
  }

  beforeEach(() => {
    // The no-Fabric branch emits a one-time dev warning; keep it out of test output.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    if (originalFabric === undefined) delete globalScope.nativeFabricUIManager;
    else globalScope.nativeFabricUIManager = originalFabric;
    jest.restoreAllMocks();
  });

  it('uses the legacy host on web (react-dom already preserves context)', () => {
    setPlatform('web');
    setFabric(true);
    setHostRegistered(true);
    expect(resolveOverlayHostMode()).toBe('legacy');
  });

  it('uses the teleport host on native with the New Architecture and a registered host view', () => {
    setPlatform('ios');
    setFabric(true);
    setHostRegistered(true);
    expect(resolveOverlayHostMode()).toBe('teleport');
  });

  it('falls back to the legacy host on native without the New Architecture', () => {
    setPlatform('android');
    setFabric(false);
    setHostRegistered(true);
    expect(resolveOverlayHostMode()).toBe('legacy');
  });

  it('falls back to the legacy host when the native host view is not registered', () => {
    setPlatform('ios');
    setFabric(true);
    setHostRegistered(false);
    expect(resolveOverlayHostMode()).toBe('legacy');
  });
});
