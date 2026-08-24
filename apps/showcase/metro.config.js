const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});

// Ensure 'web' is a resolver platform so platform-specific modules (e.g. BeeUI's
// overlay-transport.web.tsx react-dom transport) resolve on web exports.
if (!config.resolver.platforms.includes('web')) {
  config.resolver.platforms = [...config.resolver.platforms, 'web'];
}

module.exports = config;
