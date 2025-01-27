import { LabIcon, redoIcon, undoIcon } from '@jupyterlab/ui-components';
import { geoJSONIcon, moundIcon, rasterIcon } from './icons';

/**
 * The command IDs.
 */
export namespace CommandIDs {
  export const createNew = 'jupytergis:create-new-jGIS-file';
  export const redo = 'jupytergis:redo';
  export const undo = 'jupytergis:undo';
  export const symbology = 'jupytergis:symbology';
  export const identify = 'jupytergis:identify';
  export const temporal = 'jupytergis:temporal';

  // Layers and sources creation commands
  export const openLayerBrowser = 'jupytergis:openLayerBrowser';

  // Layer and source
  export const newRasterEntry = 'jupytergis:newRasterEntry';
  export const newVectorTileEntry = 'jupytergis:newVectorTileEntry';
  export const newGeoJSONEntry = 'jupytergis:newGeoJSONEntry';
  export const newHillshadeEntry = 'jupytergis:newHillshadeEntry';
  export const newImageEntry = 'jupytergis:newImageEntry';
  export const newVideoEntry = 'jupytergis:newVideoEntry';
  export const newGeoTiffEntry = 'jupytergis:newGeoTiffEntry';

  // Sources only commands
  export const newRasterSource = 'jupytergis:newRasterSource';
  export const newRasterDemSource = 'jupytergis:newRasterDemSource';
  export const newVectorSource = 'jupytergis:newVectorSource';
  export const newGeoJSONSource = 'jupytergis:newGeoJSONSource';
  export const newImageSource = 'jupytergis:imageSource';
  export const newVideoSource = 'jupytergis:videoSource';
  export const newShapefileSource = 'jupytergis:shapefileSource';
  export const newGeoTiffSource = 'jupytergis:newGeoTiffSource';

  // Layers only commands
  export const newRasterLayer = 'jupytergis:newRasterLayer';
  export const newVectorLayer = 'jupytergis:newVectorLayer';
  export const newHillshadeLayer = 'jupytergis:newHillshadeLayer';
  export const newImageLayer = 'jupytergis:newImageLayer';
  export const newVideoLayer = 'jupytergis:newVideoLayer';
  export const newShapefileLayer = 'jupytergis:newShapefileLayer';
  export const newWebGlTileLayer = 'jupytergis:newWebGlTileLayer';
  export const newHeatmapLayer = 'jupytergis:newHeatmapLayer';

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
  [CommandIDs.openLayerBrowser]: { iconClass: 'fa fa-book-open' },
  [CommandIDs.newRasterEntry]: { icon: rasterIcon },
  [CommandIDs.newVectorTileEntry]: { iconClass: 'fa fa-vector-square' },
  [CommandIDs.newGeoJSONEntry]: { icon: geoJSONIcon },
  [CommandIDs.newHillshadeEntry]: { icon: moundIcon },
  [CommandIDs.newImageEntry]: { iconClass: 'fa fa-image' },
  [CommandIDs.newVideoEntry]: { iconClass: 'fa fa-video' },
  [CommandIDs.newShapefileLayer]: { iconClass: 'fa fa-file' },
  [CommandIDs.newGeoTiffEntry]: { iconClass: 'fa fa-image' },
  [CommandIDs.symbology]: { iconClass: 'fa fa-brush' },
  [CommandIDs.identify]: { iconClass: 'fa fa-info' },
  [CommandIDs.temporal]: { iconClass: 'fa fa-clock' }
};

/**
 * The registered icons
 */
export const icons = new Map<string, IRegisteredIcon>(
  Object.entries(iconObject)
);
