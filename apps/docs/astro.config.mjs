import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  integrations: [
    starlight({
      title: 'BeeUI',
      description:
        'Production-oriented React Native components and patterns for Expo, bare React Native, and Web.',
      defaultLocale: 'en',
      lastUpdated: false,
      pagination: true,
      customCss: ['./src/styles/custom.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/beobungbu/BeeUI',
        },
      ],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Overview', slug: 'getting-started' },
            { label: 'Expo', slug: 'getting-started/expo' },
            { label: 'Bare React Native', slug: 'getting-started/bare-react-native' },
            { label: 'Web', slug: 'getting-started/web' },
            { label: 'Provider & safe area', slug: 'getting-started/provider-safe-area' },
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
            { label: 'Table', slug: 'components/table' },
            { label: 'Calendar & date/time', slug: 'components/calendar-date-time' },
          ],
        },
        {
          label: 'Patterns',
          items: [{ label: 'Overview', slug: 'patterns' }],
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
