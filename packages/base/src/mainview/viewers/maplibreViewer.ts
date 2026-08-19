import { OpenLayersViewer } from './openlayersViewer';

/**
 * Temporary MapLibre viewer implementation.
 *
 * MapLibre is not implemented yet, so it currently inherits the
 * OpenLayers implementation. This allows the application to expose
 * MapLibre as a selectable viewer without changing the existing
 * rendering behavior.
 */
export class MapLibreViewer extends OpenLayersViewer {
  // MapLibre-specific implementation will be added in follow ups.
}
