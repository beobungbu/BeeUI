const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// @beemvp/beeui-core, @beemvp/beeui-tokens, and @beemvp/beeui-ui publish a `source` exports
// condition alongside their built `dist/` output (#199/#200). Inside this
// monorepo the workspace-linked packages resolve through node_modules
// exports too, so without this override Metro would resolve the `browser`
// condition on the web platform straight to `dist/`, forcing a build step
// into every internal workspace app's pipeline. Putting `source` first for
// every platform here restores the pre-#199/#200 behavior of Metro compiling
// straight from `src/` for internal apps, keeping visual baselines and
// bundling behavior byte-identical without requiring a build.
for (const platform of Object.keys(config.resolver.unstable_conditionsByPlatform ?? {})) {
  const existing = config.resolver.unstable_conditionsByPlatform[platform] ?? [];
  config.resolver.unstable_conditionsByPlatform[platform] = ['source', ...existing];
}

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: ['violet-light', 'violet-dark', 'high-contrast-light', 'high-contrast-dark'],
});
