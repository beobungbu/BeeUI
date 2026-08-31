const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: ['violet-light', 'violet-dark', 'high-contrast-light', 'high-contrast-dark'],
});

// Ensure 'web' is a resolver platform so platform-specific modules (e.g. BeeUI's
// overlay-transport.web.tsx react-dom transport) resolve on web exports.
if (!config.resolver.platforms.includes('web')) {
  config.resolver.platforms = [...config.resolver.platforms, 'web'];
}

// @beeui/core, @beeui/tokens, and @beeui/ui publish a `source` exports
// condition alongside their built `dist/` output (#199/#200). Inside this
// monorepo the workspace-linked packages resolve through node_modules
// exports too, so without this override Metro would resolve the `browser`
// (web) / `react-native` (native) condition straight to `dist/`, forcing a
// build step into every internal workspace app's pipeline. Putting `source`
// first for every platform here restores the pre-#199/#200 behavior of
// Metro compiling straight from `src/` for internal apps.
for (const platform of Object.keys(config.resolver.unstable_conditionsByPlatform ?? {})) {
  const existing = config.resolver.unstable_conditionsByPlatform[platform] ?? [];
  config.resolver.unstable_conditionsByPlatform[platform] = ['source', ...existing];
}

module.exports = config;
