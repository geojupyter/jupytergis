/**
 * Highlight overlay for the MapLibre adapter.
 *
 * The identify tool highlights the features it finds. MapLibre has no
 * equivalent of OpenLayers' overlay layer, so this owns one GeoJSON source
 * and three style layers (fill, line, circle) that are kept above everything
 * else and emptied when there is nothing to highlight.
 */

import type { Feature } from 'geojson';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';

const SOURCE_ID = 'jgis-identify-highlight';
const FILL_ID = `${SOURCE_ID}-fill`;
const LINE_ID = `${SOURCE_ID}-line`;
const CIRCLE_ID = `${SOURCE_ID}-circle`;

const FILL_COLOR = '#80d8ff';
const STROKE_COLOR = '#00b0ff';

const toPLainFeatures = (features: Feature[]): Feature[] =>
  JSON.parse(JSON.stringify(features)) as Feature[]; // deep copy to remove any MapLibre-specific properties
export class MapLibreHighlight {
  constructor(private readonly _map: MlMap) {}

  /** Replace the highlighted features. */
  set(features: Feature[]): void {
    this._ensureLayers();
    this._source()?.setData({
      type: 'FeatureCollection',
      features: toPLainFeatures(features),
    });
    this._raise();
  }

  clear(): void {
    if (this._map.getSource(SOURCE_ID)) {
      this._source()?.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  private _source(): GeoJSONSource | undefined {
    return this._map.getSource(SOURCE_ID) as GeoJSONSource;
  }

  private _ensureLayers(): void {
    if (this._map.getSource(SOURCE_ID)) {
      return;
    }

    this._map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // geometry-type reports Multi* geometries as their base type.
    this._map.addLayer({
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': FILL_COLOR, 'fill-opacity': 0.35 },
    });
    this._map.addLayer({
      id: LINE_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: [
        'any',
        ['==', ['geometry-type'], 'Polygon'],
        ['==', ['geometry-type'], 'LineString'],
      ],
      paint: { 'line-color': STROKE_COLOR, 'line-width': 3 },
    });
    this._map.addLayer({
      id: CIRCLE_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 8,
        'circle-color': FILL_COLOR,
        'circle-opacity': 0.9,
        'circle-stroke-color': STROKE_COLOR,
        'circle-stroke-width': 2,
      },
    });
  }

  /** Layers added after the highlight would otherwise draw over it. */
  private _raise(): void {
    for (const id of [FILL_ID, LINE_ID, CIRCLE_ID]) {
      if (this._map.getLayer(id)) {
        this._map.moveLayer(id);
      }
    }
  }
}
