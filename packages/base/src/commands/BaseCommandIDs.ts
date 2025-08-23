/* This file is not an exhaustive list of commands.
 *
 * See the documentation for more details.
 */
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
export const newGeoParquetEntry = 'jupytergis:newGeoParquetEntry';
export const newGeoPackageRasterEntry = 'jupytergis:newGeoPackageRasterEntry';
export const newGeoPackageVectorEntry = 'jupytergis:newGeoPackageVectorEntry';

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
