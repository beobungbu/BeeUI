#!/usr/bin/env node

// Reports how many generated prop rows carry a description, against the ratchet floor.
// Read-only: the gate itself lives in `collectPropDescriptionViolations`.

import {
  PROP_DESCRIPTION_FLOOR,
  buildPublicComponentManifest,
  collectPropDescriptionCoverage,
} from './public-component-reference.mjs';

const { described, total } = collectPropDescriptionCoverage(buildPublicComponentManifest());
const percent = Math.round((described / total) * 100);
console.log(`prop descriptions: ${described}/${total} (${percent}%), floor ${PROP_DESCRIPTION_FLOOR}`);
