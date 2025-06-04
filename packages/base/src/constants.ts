import { LabIcon, redoIcon, undoIcon } from '@jupyterlab/ui-components';

import {
  bookOpenIcon,
  clockIcon,
  geoJSONIcon,
  infoIcon,
  moundIcon,
  rasterIcon,
  vectorSquareIcon
} from './icons';

/**
 * The command IDs.
 */
export namespace CommandIDs {
  export const createNew = 'jupytergis:create-new-jGIS-file';
  export const redo = 'jupytergis:redo';
  export const undo = 'jupytergis:undo';
  export const symbology = 'jupytergis:symbology';
  export const identify = 'jupytergis:identify';
  export const temporalController = 'jupytergis:temporalController';

  // geolocation
  export const getGeolocation = 'jupytergis:getGeolocation';

  // Layers and sources creation commands
  export const openLayerBrowser = 'jupytergis:openLayerBrowser';

  // Layer and source
  export const newRasterEntry = 'jupytergis:newRasterEntry';
  export const newVectorTileEntry = 'jupytergis:newVectorTileEntry';
  export const newShapefileEntry = 'jupytergis:newShapefileEntry';
  export const newGeoJSONEntry = 'jupytergis:newGeoJSONEntry';
  export const newHillshadeEntry = 'jupytergis:newHillshadeEntry';
  export const newImageEntry = 'jupytergis:newImageEntry';
  export const newVideoEntry = 'jupytergis:newVideoEntry';
  export const newGeoTiffEntry = 'jupytergis:newGeoTiffEntry';

  // Processing commands
  export const buffer = 'jupytergis:buffer';
  export const dissolve = 'jupytergis:dissolve';

  // Layer and group actions
  export const renameLayer = 'jupytergis:renameLayer';
  export const removeLayer = 'jupytergis:removeLayer';
  export const renameGroup = 'jupytergis:renameGroup';
  export const removeGroup = 'jupytergis:removeGroup';
  export const moveLayersToGroup = 'jupytergis:moveLayersToGroup';
  export const moveLayerToNewGroup = 'jupytergis:moveLayerToNewGroup';

  // Source actions
  export const renameSource = 'jupytergis:renameSource';
  export const removeSource = 'jupytergis:removeSource';

  // Console commands
  export const toggleConsole = 'jupytergis:toggleConsole';
  export const invokeCompleter = 'jupytergis:invokeConsoleCompleter';
  export const removeConsole = 'jupytergis:removeConsole';
  export const executeConsole = 'jupytergis:executeConsole';
  export const selectCompleter = 'jupytergis:selectConsoleCompleter';

  // Map Commands
  export const addAnnotation = 'jupytergis:addAnnotation';
  export const zoomToLayer = 'jupytergis:zoomToLayer';
  export const downloadGeoJSON = 'jupytergis:downloadGeoJSON';
}

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
  [CommandIDs.newShapefileEntry]: { iconClass: 'fa fa-file' },
  [CommandIDs.newGeoTiffEntry]: { iconClass: 'fa fa-image' },
  [CommandIDs.symbology]: { iconClass: 'fa fa-brush' },
  [CommandIDs.identify]: { icon: infoIcon },
  [CommandIDs.temporalController]: { icon: clockIcon }
};

/**
 * The registered icons
 */
export const icons = new Map<string, IRegisteredIcon>(
  Object.entries(iconObject)
);
