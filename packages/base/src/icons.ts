/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

// This file is based on iconimports.ts in @jupyterlab/ui-components, but is manually generated.

import { LabIcon } from '@jupyterlab/ui-components';

import rasterSvgStr from '../style/icons/raster.svg';
import visibilitySvgStr from '../style/icons/visibility.svg';
import nonVisibilitySvgStr from '../style/icons/nonvisibility.svg';

export const rasterIcon = new LabIcon({
  name: 'jupytergis::raster',
  svgstr: rasterSvgStr
});

export const visibilityIcon = new LabIcon({
  name: 'jupytergis::visibility',
  svgstr: visibilitySvgStr
});

export const nonVisibilityIcon = new LabIcon({
  name: 'jupytergis::nonVisibility',
  svgstr: nonVisibilitySvgStr
});
