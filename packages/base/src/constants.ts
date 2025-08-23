import { IDict, ProcessingCommandIDs } from '@jupytergis/schema';
import { LabIcon, redoIcon, undoIcon } from '@jupyterlab/ui-components';

import * as BaseCommandIDs from './commands/BaseCommandIDs';
import {
  bookOpenIcon,
  clockIcon,
  geoJSONIcon,
  geoPackageIcon,
  infoIcon,
  moundIcon,
  rasterIcon,
  vectorSquareIcon,
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
  [CommandIDs.newRasterEntry]: { icon: rasterIcon },
  [CommandIDs.newVectorTileEntry]: { icon: vectorSquareIcon },
  [CommandIDs.newGeoJSONEntry]: { icon: geoJSONIcon },
  [CommandIDs.newHillshadeEntry]: { icon: moundIcon },
  [CommandIDs.newImageEntry]: { iconClass: 'fa fa-image' },
  [CommandIDs.newVideoEntry]: { iconClass: 'fa fa-video' },
  [CommandIDs.newGeoPackageVectorEntry]: { icon: geoPackageIcon },
  [CommandIDs.newGeoPackageRasterEntry]: { icon: geoPackageIcon },
  [CommandIDs.newShapefileEntry]: { iconClass: 'fa fa-file' },
  [CommandIDs.newGeoTiffEntry]: { iconClass: 'fa fa-image' },
  [CommandIDs.newGeoParquetEntry]: { iconClass: 'fa fa-file' },
  [CommandIDs.symbology]: { iconClass: 'fa fa-brush' },
  [CommandIDs.identify]: { icon: infoIcon },
  [CommandIDs.temporalController]: { icon: clockIcon },
};

/**
 * The registered icons
 */
export const icons = new Map<string, IRegisteredIcon>(
  Object.entries(iconObject),
);
