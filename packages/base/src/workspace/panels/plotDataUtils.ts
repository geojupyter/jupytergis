/**
 * Utilities for extracting feature property data from OL sources.
 *
 * These functions bridge OL's feature model to plain objects suitable
 * for Vega-Lite's data.values array.
 */

import { Feature } from 'ol';
import { Geometry } from 'ol/geom';

/**
 * Extract clean property objects from an OL feature, stripping
 * the non-serializable `geometry` key.
 */
export function featureToRow(
  feature: Feature<Geometry>,
): Record<string, unknown> {
  const props = feature.getProperties() ?? {};
  // OL stores the geometry object under the 'geometry' key — not JSON-serializable.
  const { geometry: _, ...data } = props as Record<string, unknown>;
  return data;
}

/**
 * Extract feature property rows from any OL source that supports forEachFeature.
 * Returns an empty array for non-vector sources (Tile, Image, etc.).
 */
export function sourceToRows(source: any): Record<string, unknown>[] {
  if (!source || typeof source.forEachFeature !== 'function') {
    return [];
  }
  const rows: Record<string, unknown>[] = [];
  source.forEachFeature((feature: Feature<Geometry>) => {
    rows.push(featureToRow(feature));
  });
  return rows;
}
