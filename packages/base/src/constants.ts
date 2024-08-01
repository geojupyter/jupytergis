import { LabIcon, redoIcon, undoIcon } from '@jupyterlab/ui-components';
import { geoJSONIcon, moundIcon, rasterIcon } from './icons';

/**
 * The command IDs.
 */
export namespace CommandIDs {
  export const createNew = 'jupytergis:create-new-jGIS-file';
  export const redo = 'jupytergis:redo';
  export const undo = 'jupytergis:undo';

  // Layers and sources creation commands
  export const openLayerBrowser = 'jupytergis:openLayerBrowser';

  // Layer and source
  export const newRasterEntry = 'jupytergis:newRasterEntry';
  export const newVectorTileEntry = 'jupytergis:newVectorTileEntry';
  export const newGeoJSONEntry = 'jupytergis:newGeoJSONEntry';
  export const newHillshadeEntry = 'jupytergis:newHillshadeEntry';
  export const newImageEntry = 'jupytergis:newImageEntry';
  export const newVideoEntry = 'jupytergis:newVideoEntry';

  // Sources only commands
  export const newRasterSource = 'jupytergis:newRasterSource';
  export const newRasterDemSource = 'jupytergis:newRasterDemSource';
  export const newVectorSource = 'jupytergis:newVectorSource';
  export const newGeoJSONSource = 'jupytergis:newGeoJSONSource';
  export const newImageSource = 'jupytergis:imageSource';
  export const newVideoSource = 'jupytergis:videoSource';

  // Layers only commands
  export const newRasterLayer = 'jupytergis:newRasterLayer';
  export const newVectorLayer = 'jupytergis:newVectorLayer';
  export const newHillshadeLayer = 'jupytergis:newHillshadeLayer';
  export const newImageLayer = 'jupytergis:newImageLayer';
  export const newVideoLayer = 'jupytergis:newVideoLayer';

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

  // Terrain stuff
  export const newTerrain = 'jupytergis:newTerrain';
  export const removeTerrain = 'jupytergis:removeTerrain';
}

interface IRegisteredIcon {
  icon?: LabIcon;
  iconClass?: string;
}

const iconObject = {
  RasterSource: { icon: rasterIcon },
  GeoJSONSource: { icon: geoJSONIcon },
  VectorTileSource: { iconClass: 'fa fa-vector-square' },
  RasterLayer: { icon: rasterIcon },
  [CommandIDs.redo]: { icon: redoIcon },
  [CommandIDs.undo]: { icon: undoIcon },
  [CommandIDs.openLayerBrowser]: { iconClass: 'fa fa-book-open' },
  [CommandIDs.newRasterEntry]: { icon: rasterIcon },
  [CommandIDs.newVectorTileEntry]: { iconClass: 'fa fa-vector-square' },
  [CommandIDs.newGeoJSONEntry]: { icon: geoJSONIcon },
  [CommandIDs.newHillshadeEntry]: { icon: moundIcon },
  [CommandIDs.newImageEntry]: { iconClass: 'fa fa-image' },
  [CommandIDs.newVideoEntry]: { iconClass: 'fa fa-video' },
  [CommandIDs.newTerrain]: { iconClass: 'fa fa-mountain' }
};

/**
 * The registered icons
 */
export const icons = new Map<string, IRegisteredIcon>(
  Object.entries(iconObject)
);
