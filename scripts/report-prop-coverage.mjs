#!/usr/bin/env node

// Reports how many generated prop rows carry a description, against the ratchet floor.
// Read-only: the gate itself lives in `collectPropDescriptionViolations`.

import {
  PROP_DESCRIPTION_FLOOR,
  buildPublicComponentManifest,
  collectPropDescriptionCoverage,
} from './public-component-reference.mjs';

const { described, total } = collectPropDescriptionCoverage(buildPublicComponentManifest());
// Floor, never round: Math.round reports 583 of 584 as "100%", which hides exactly the
// single-prop gap this number exists to surface.
const percent = total === 0 ? 100 : Math.floor((described / total) * 100);
console.log(`prop descriptions: ${described}/${total} (${percent}%), floor ${PROP_DESCRIPTION_FLOOR}`);
