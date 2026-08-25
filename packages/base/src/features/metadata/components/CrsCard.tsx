import * as React from 'react';

import { ICrsMetadata, IMetadataField } from '../types';
import { FieldList, MetadataSection } from './MetadataSection';
import { getCrsInfoUrl } from '../utils/crs';

/**
 * Where a reader who does not know what a projection is can go to find out.
 */
const CRS_GLOSSARY_URL =
  'https://jupytergis.readthedocs.io/en/latest/about/glossary.html';

interface ICrsCardProps {
  crs: ICrsMetadata;
}

/**
 * The coordinate reference system the data is stored in.
 *
 * This is the section the issue calls out as hard to interpret, so it leads
 * with the plain-language name where we have one, and always offers somewhere
 * to go and read more.
 */
export const CrsCard: React.FC<ICrsCardProps> = ({ crs }) => {
  const fields: IMetadataField[] = [];

  if (crs.code) {
    fields.push({
      label: 'Code',
      value: crs.code,
      href: getCrsInfoUrl(crs.code),
    });
  }

  if (crs.name) {
    fields.push({ label: 'Name', value: crs.name });
  }

  if (crs.units) {
    fields.push({ label: 'Units', value: crs.units });
  }

  if (crs.proj4) {
    fields.push({ label: 'proj4', value: crs.proj4, mono: true });
  }

  if (crs.wkt) {
    fields.push({ label: 'WKT', value: crs.wkt, mono: true });
  }

  if (!fields.length) {
    return null;
  }

  return (
    <MetadataSection title="Coordinate reference system">
      <FieldList fields={fields} />
      <p className="m-0 text-xs text-muted-foreground">
        A coordinate reference system describes how the numbers in this data map
        onto positions on the Earth.{' '}
        <a
          href={CRS_GLOSSARY_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary hover:underline"
        >
          Learn about coordinate reference systems
        </a>
        .
      </p>
    </MetadataSection>
  );
};
