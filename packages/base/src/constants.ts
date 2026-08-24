import { ProcessingCommandIDs } from '@jupytergis/schema';
import { LabIcon, redoIcon, undoIcon } from '@jupyterlab/ui-components';

import * as BaseCommandIDs from './commands/BaseCommandIDs';
import {
  bookOpenIcon,
  clockIcon,
  columns2Icon,
  dbIcon,
  geoJSONIcon,
  geoPackageIcon,
  infoIcon,
  moundIcon,
  rasterIcon,
  vectorSquareIcon,
  markerIcon,
  pencilSolidIcon,
  scrollIcon,
} from './shared/icons';

/**
 * The command IDs.
 */
export const CommandIDs: typeof BaseCommandIDs & typeof ProcessingCommandIDs = {
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
  FeatureStoreSource: { iconClass: 'fa fa-store' },
  ImageSource: { iconClass: 'fa fa-image' },
  ShapefileSource: { iconClass: 'fa fa-file' },

  RasterLayer: { icon: rasterIcon },
  OpenEOTileLayer: { icon: rasterIcon },
  VectorLayer: { iconClass: 'fa fa-vector-square' },
  VectorTileLayer: { iconClass: 'fa fa-vector-square' },
  HillshadeLayer: { icon: moundIcon },
  GeoTiffLayer: { iconClass: 'fa fa-image' },
  StacLayer: { icon: rasterIcon },
  ImageLayer: { iconClass: 'fa fa-image' },
  StorySegmentLayer: { iconClass: 'fa fa-link' },

  [CommandIDs.redo]: { icon: redoIcon },
  [CommandIDs.undo]: { icon: undoIcon },
  [CommandIDs.openLayerBrowser]: { icon: bookOpenIcon },
  [CommandIDs.openNewRasterDialog]: { icon: rasterIcon },
  [CommandIDs.openNewWmsDialog]: { iconClass: 'fa fa-server' },
  [CommandIDs.openNewVectorTileDialog]: { icon: vectorSquareIcon },
  [CommandIDs.openNewGeoJSONDialog]: { icon: geoJSONIcon },
  [CommandIDs.openNewHillshadeDialog]: { icon: moundIcon },
  [CommandIDs.openNewImageDialog]: { iconClass: 'fa fa-image' },
  [CommandIDs.newGeoPackageVectorEntry]: { icon: geoPackageIcon },
  [CommandIDs.newGeoPackageRasterEntry]: { icon: geoPackageIcon },
  [CommandIDs.openNewShapefileDialog]: { iconClass: 'fa fa-file' },
  [CommandIDs.openNewGeoTiffDialog]: { iconClass: 'fa fa-image' },
  [CommandIDs.openNewGeoZarrDialog]: { iconClass: 'fa fa-image' },
  [CommandIDs.openNewGeoParquetDialog]: { iconClass: 'fa fa-file' },
  [CommandIDs.openNewOpenEODialog]: { icon: rasterIcon },
  [CommandIDs.symbology]: { iconClass: 'fa fa-brush' },
  [CommandIDs.identify]: { icon: infoIcon },
  [CommandIDs.temporalController]: { icon: clockIcon },
  [CommandIDs.addMarker]: { icon: markerIcon },
  [CommandIDs.foldFeatureStore]: { icon: dbIcon },
  [CommandIDs.openNewFeatureStoreDialog]: { iconClass: 'fa fa-store' },
  [CommandIDs.toggleDrawFeatures]: { icon: pencilSolidIcon },
  [CommandIDs.addStorySegment]: { iconClass: 'fa fa-link' },
  [CommandIDs.openStoryEditor]: {
    // iconClass is ignored when `icon` is a LabIcon, bind className instead.
    icon: scrollIcon.bindprops({ className: 'jgis-icon-adjust' }),
  },
  [CommandIDs.showLayerPropertiesDialog]: { iconClass: 'fa fa-sliders' },
  [CommandIDs.renameSelected]: { iconClass: 'fa fa-pen' },
  [CommandIDs.removeSelected]: { iconClass: 'fa fa-trash' },
  [CommandIDs.togglePanel]: { icon: columns2Icon },
};

/**
 * The registered icons
 */
export const icons = new Map<string, IRegisteredIcon>(
  Object.entries(iconObject),
);
