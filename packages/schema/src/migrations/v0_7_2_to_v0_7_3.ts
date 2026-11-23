/**
 * Migration from schema version 0.7.2 to 0.7.3.
 *
 * OpenLayers saved `options.bearing` as its view rotation in radians. It is
 * now the compass bearing in degrees, as MapLibre and story segments save it.
 */

export function migrate(doc: Record<string, any>): Record<string, any> {
  const options = doc.options;
  if (!options?.bearing || options.mapAdapter === 'maplibre') {
    return doc;
  }

  return {
    ...doc,
    options: { ...options, bearing: -(options.bearing * 180) / Math.PI },
  };
}
