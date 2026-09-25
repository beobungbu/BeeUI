import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    // `releaseStatus: true` opts a page into the generated release-status callout, rendered by
    // the `PageTitle` override (src/components/ReleaseStatusPageTitle.astro) from the shared
    // renderer (scripts/release-status-lib.mjs) instead of a hand-written per-page paragraph.
    schema: docsSchema({ extend: z.object({ releaseStatus: z.boolean().optional() }) }),
  }),
};
