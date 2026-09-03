import * as React from 'react';
import { ComponentGallery as BaseComponentGallery } from './component-gallery';
import { PublicDocFixtures } from './public-doc-fixtures';

type ComponentGalleryProps = React.ComponentProps<typeof BaseComponentGallery>;

export function ComponentGallery(props: ComponentGalleryProps) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(BaseComponentGallery, props),
    React.createElement(PublicDocFixtures),
  );
}
