import * as React from 'react';
import { ComponentGallery as BaseComponentGallery } from './component-gallery';
import { PublicDocFixtures } from './public-doc-fixtures';

export function ComponentGallery() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(BaseComponentGallery),
    React.createElement(PublicDocFixtures),
  );
}
