import * as React from 'react';
import { ComponentGallery as BaseComponentGallery } from './component-gallery';
import { PublicDocFixtures } from './public-doc-fixtures';

export function ComponentGallery() {
  return (
    <>
      <BaseComponentGallery />
      <PublicDocFixtures />
    </>
  );
}
