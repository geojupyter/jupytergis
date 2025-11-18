import { IDict, ProcessingCommandIDs } from '@jupytergis/schema';
import { LabIcon, redoIcon, undoIcon } from '@jupyterlab/ui-components';

import * as BaseCommandIDs from './commands/BaseCommandIDs';
import {
  bookOpenIcon,
  clockIcon,
  geoJSONIcon,
  infoIcon,
  moundIcon,
  rasterIcon,
  vectorSquareIcon,
  markerIcon,
} from './icons';

/**
 * The command IDs.
 */

export const CommandIDs: IDict = {
  ...BaseCommandIDs,
  ...ProcessingCommandIDs,
};

interface IRegisteredIcon {
  icon?: LabIcon;
  iconClass?: string;
}

const iconObject = {
  RasterSource: { icon: rasterIcon },
  RasterDemSource: { icon: moundIcon },
  VectorTileSource: { iconClass: 'fa fa-vector-square' },
  GeoJSONSource: { icon: geoJSONIcon },
  ImageSource: { iconClass: 'fa fa-image' },
  VideoSource: { iconClass: 'fa fa-video' },
  ShapefileSource: { iconClass: 'fa fa-file' },

  RasterLayer: { icon: rasterIcon },
  VectorLayer: { iconClass: 'fa fa-vector-square' },
  HillshadeLayer: { icon: moundIcon },
  ImageLayer: { iconClass: 'fa fa-image' },
  VideoLayer: { iconClass: 'fa fa-video' },

  [CommandIDs.redo]: { icon: redoIcon },
  [CommandIDs.undo]: { icon: undoIcon },
  [CommandIDs.openLayerBrowser]: { icon: bookOpenIcon },
  [CommandIDs.opeNewRasterDialog]: { icon: rasterIcon },
  [CommandIDs.openNewVectorTileDialog]: { icon: vectorSquareIcon },
  [CommandIDs.openNewGeoJSONDialog]: { icon: geoJSONIcon },
  [CommandIDs.openNewHillshadeDialog]: { icon: moundIcon },
  [CommandIDs.openNewImageDialog]: { iconClass: 'fa fa-image' },
  [CommandIDs.openNewVideoDialog]: { iconClass: 'fa fa-video' },
  [CommandIDs.openNewShapefileDialog]: { iconClass: 'fa fa-file' },
  [CommandIDs.openNewGeoTiffDialog]: { iconClass: 'fa fa-image' },
  [CommandIDs.openNewGeoParquetDialog]: { iconClass: 'fa fa-file' },
  [CommandIDs.symbology]: { iconClass: 'fa fa-brush' },
  [CommandIDs.identify]: { icon: infoIcon },
  [CommandIDs.temporalController]: { icon: clockIcon },
  [CommandIDs.addMarker]: { icon: markerIcon },
};

/**
 * The registered icons
 */
export const icons = new Map<string, IRegisteredIcon>(
  Object.entries(iconObject),
);
