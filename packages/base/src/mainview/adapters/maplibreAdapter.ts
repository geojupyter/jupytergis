import { OpenLayersAdapter } from './openlayersAdapter';

/**
 * Temporary MapLibre adapter implementation.
 *
 * MapLibre is not implemented yet, so it currently inherits the
 * OpenLayers implementation. This allows the application to expose
 * MapLibre as a selectable adapter without changing the existing
 * rendering behavior.
 */
export class MapLibreAdapter extends OpenLayersAdapter {
  // MapLibre-specific implementation will be added in follow ups.
}
