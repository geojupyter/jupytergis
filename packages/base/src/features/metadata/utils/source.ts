import { IJGISSource } from '@jupytergis/schema';

import { IMetadataField } from '../types';

/**
 * Where a source's data actually lives.
 *
 * Sources are inconsistent about this: some carry `url`, some `path`, GeoTIFF
 * carries an array of `urls`, and some carry inline `data` instead of a
 * location at all.
 */
export function getSourceLocation(source: IJGISSource): string | undefined {
  const parameters = source.parameters ?? {};

  if (typeof parameters.url === 'string' && parameters.url) {
    return parameters.url;
  }

  if (typeof parameters.path === 'string' && parameters.path) {
    return parameters.path;
  }

  const firstUrl = Array.isArray(parameters.urls)
    ? parameters.urls[0]?.url
    : undefined;
  if (typeof firstUrl === 'string' && firstUrl) {
    return firstUrl;
  }

  return undefined;
}

/**
 * Render a source location as a field, linking it when it is an addressable
 * URL and truncating inline data URIs (which can be megabytes long).
 */
export function getSourceLocationField(
  source: IJGISSource,
): IMetadataField | undefined {
  const location = getSourceLocation(source);

  if (!location) {
    return source.parameters?.data
      ? { label: 'Data', value: 'Embedded in this document' }
      : undefined;
  }

  if (location.startsWith('data:')) {
    return {
      label: 'Data',
      value: 'Embedded in this document (data URI)',
    };
  }

  const isRemote =
    location.startsWith('http://') || location.startsWith('https://');

  return {
    label: isRemote ? 'URL' : 'Path',
    value: location,
    mono: true,
    href: isRemote ? location : undefined,
  };
}

/**
 * Space out the `Layer`/`Source` suffix of a type name, so `GeoTiffSource`
 * reads as `GeoTiff Source`.
 *
 * Only the suffix is split: breaking the rest apart as well would turn
 * `GeoTiffSource` into `Geo Tiff Source`, and the format names are how they are
 * spelled in the documentation and in the `.jGIS` file itself.
 */
export function humanizeTypeName(type: string): string {
  return type.replace(/(Layer|Source)$/, ' $1').trim();
}
