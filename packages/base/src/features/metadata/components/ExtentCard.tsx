import * as React from 'react';

import { IExtentMetadata, IMetadataField } from '../types';
import { FieldList, MetadataSection } from './MetadataSection';
import { formatExtent } from '../utils/format';

interface IExtentCardProps {
  extent: IExtentMetadata;
}

/**
 * The geographic extent of the data, given both in its own CRS and in
 * longitude/latitude.
 */
export const ExtentCard: React.FC<IExtentCardProps> = ({ extent }) => {
  const fields: IMetadataField[] = [];

  const native = formatExtent(extent.native);
  if (native) {
    fields.push({
      label: extent.nativeCrs ? `In ${extent.nativeCrs}` : 'Native',
      value: native,
      mono: true,
    });
  }

  const wgs84 = formatExtent(extent.wgs84);
  if (wgs84 && wgs84 !== native) {
    fields.push({ label: 'In EPSG:4326', value: wgs84, mono: true });
  }

  if (!fields.length) {
    return null;
  }

  return (
    <MetadataSection title="Extent" summary="min X, min Y, max X, max Y">
      <FieldList fields={fields} />
      {extent.approximate ? (
        <p className="m-0 text-xs text-muted-foreground">
          This is the extent of the layer as drawn on the map. JupyterGIS could
          not read an extent from the data itself.
        </p>
      ) : null}
    </MetadataSection>
  );
};
