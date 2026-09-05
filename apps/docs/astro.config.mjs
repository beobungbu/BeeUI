import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { buildPublicSiteContract } from '../../scripts/public-site-contract-lib.mjs';
import { PAGEFIND_RANKING } from './pagefind-ranking.mjs';

const publicSite = buildPublicSiteContract();

// W2 (#414) owns global public-site route/IA authority. Content workstreams may
// add pages and sidebar-local entries, but canonical origin/base paths and
// top-level product navigation come from web/public-site.config.json.
export default defineConfig({
  site: publicSite.origin,
  base: publicSite.docsBase,
  output: 'static',
  integrations: [
    starlight({
      title: 'BeeUI',
      description:
        'BeeUI is a production-oriented React Native UI system for Expo, bare React Native, and Web.',
      defaultLocale: 'en',
      lastUpdated: false,
      pagination: true,
      components: {
        // Adds a `data-pagefind-filter` meta tag per page, driven only by the route slug, so
        // the built index carries a `section` facet (#466) without hand-editing any generated
        // page. Index-side only: Starlight ships its own search modal with no filter control,
        // so readers cannot narrow by section yet — see #500 and the note in
        // src/components/SearchFilterHead.astro.
        Head: './src/components/SearchFilterHead.astro',
      },
      pagefind: {
        ranking: PAGEFIND_RANKING,
      },
      sidebar: [
        {
          label: 'Start',
          items: [
            { label: 'Overview', slug: 'start' },
            { label: 'Expo', slug: 'start/expo' },
            { label: 'Bare React Native', slug: 'start/bare-react-native' },
            { label: 'Web', slug: 'start/web' },
            { label: 'Provider & safe area', slug: 'start/provider-safe-area' },
          ],
        },
        {
          label: 'Showcase & preview',
          items: [{ label: 'Web & native preview', slug: 'showcase' }],
        },
        {
          label: 'Learn',
          items: [
            { label: 'Overview', slug: 'learn' },
            { label: 'Foundations', slug: 'learn/foundations' },
            { label: 'Ownership model', slug: 'learn/ownership-model' },
            { label: 'Composition model', slug: 'learn/composition-model' },
            { label: 'State model', slug: 'learn/state-model' },
            { label: 'Overlays & runtime', slug: 'learn/overlays-and-runtime' },
            { label: 'Forms model', slug: 'learn/forms-model' },
            { label: 'Cross-platform model', slug: 'learn/cross-platform-model' },
            { label: 'Responsive model', slug: 'learn/responsive-model' },
            { label: 'Accessibility model', slug: 'learn/accessibility-model' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Overview', slug: 'guides' },
            { label: 'Branding', slug: 'guides/branding' },
            { label: 'Density', slug: 'guides/density' },
            { label: 'Table', slug: 'guides/table' },
            { label: 'Dates & times', slug: 'guides/date-time' },
            { label: 'CLI & source ownership', slug: 'guides/cli-source-ownership' },
            { label: 'Troubleshooting', slug: 'guides/troubleshooting' },
            { label: 'Migration & versioning', slug: 'guides/migration-versioning' },
          ],
        },
        {
          label: 'Theming',
          items: [{ label: 'Overview', slug: 'theming' }],
        },
        {
          label: 'Components',
          items: [{ autogenerate: { directory: 'components' } }],
        },
        {
          label: 'Patterns',
          items: [{ autogenerate: { directory: 'patterns' } }],
        },
        {
          label: 'Accessibility',
          items: [
            { label: 'Overview', slug: 'accessibility' },
            { label: 'RTL & localization', slug: 'accessibility/rtl' },
            { label: 'Large text & zoom', slug: 'accessibility/large-text' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Overview', slug: 'reference' },
            { label: 'Tokens', slug: 'reference/tokens' },
            { label: 'Core', slug: 'reference/core' },
            { label: 'CLI', slug: 'reference/cli' },
            { label: 'Registry', slug: 'reference/registry' },
            { label: 'Styling', slug: 'reference/styling' },
          ],
        },
        {
          label: 'Compatibility',
          items: [
            { label: 'Overview', slug: 'compatibility' },
            { label: 'Native (RN/Expo)', slug: 'compatibility/native' },
            { label: 'Web', slug: 'compatibility/web' },
          ],
        },
        {
          label: 'Performance',
          items: [{ label: 'Overview', slug: 'performance' }],
        },
        {
          label: 'Release & security',
          items: [{ label: 'Overview', slug: 'release-security' }],
        },
      ],
    }),
  ],
});
