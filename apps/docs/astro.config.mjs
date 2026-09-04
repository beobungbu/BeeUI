import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { buildPublicSiteContract } from '../../scripts/public-site-contract-lib.mjs';

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
          label: 'Theming',
          items: [
            { label: 'Overview', slug: 'theming' },
            { label: 'Branding', slug: 'theming/branding' },
            { label: 'Density', slug: 'theming/density' },
          ],
        },
        {
          label: 'Components',
          items: [
            { label: 'Overview', slug: 'components' },
            {
              label: 'Reference',
              items: [{ autogenerate: { directory: 'components/reference' } }],
            },
            { label: 'Table', slug: 'components/table' },
            { label: 'Calendar & date/time', slug: 'components/calendar-date-time' },
          ],
        },
        {
          label: 'Patterns',
          items: [
            { label: 'Overview', slug: 'patterns' },
            {
              label: 'Pattern library',
              items: [{ autogenerate: { directory: 'patterns/reference' } }],
            },
          ],
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
          label: 'CLI & source ownership',
          items: [{ label: 'Overview', slug: 'cli' }],
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
          label: 'Migration & versioning',
          items: [{ label: 'Overview', slug: 'migration' }],
        },
        {
          label: 'Troubleshooting',
          items: [{ label: 'Overview', slug: 'troubleshooting' }],
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
