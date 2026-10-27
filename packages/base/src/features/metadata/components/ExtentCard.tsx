import * as React from 'react';

import { IExtentMetadata } from '../types';
import { MetadataSection } from './MetadataSection';
import { Table, tableCellClass, tableHeaderClass } from './MetadataTables';
import { formatNumber } from '../utils/format';

interface IExtentCardProps {
  extent: IExtentMetadata;
}

interface IExtentRow {
  crs: string;
  bounds: number[];
}

/**
 * The geographic extent of the data, given both in its own CRS and in
 * longitude/latitude.
 *
 * Laid out as a table with a column per bound: the four numbers of an extent
 * mean different things, and reading them out of a comma-separated string means
 * counting commas to work out which one is which. A column header says it
 * instead, and the two coordinate reference systems line up for comparison.
 */
export const ExtentCard: React.FC<IExtentCardProps> = ({ extent }) => {
  const rows: IExtentRow[] = [];

  const native = extent.native?.slice(0, 4);
  if (native?.length === 4) {
    rows.push({ crs: extent.nativeCrs ?? 'Native', bounds: native });
  }

  // A layer already stored in longitude/latitude would otherwise be listed
  // twice with identical numbers.
  const wgs84 = extent.wgs84?.slice(0, 4);
  if (wgs84?.length === 4 && !sameBounds(wgs84, rows[0]?.bounds)) {
    rows.push({ crs: 'EPSG:4326', bounds: wgs84 });
  }

  if (!rows.length) {
    return null;
  }

  return (
    <MetadataSection title="Extent">
      <Table>
        <thead>
          <tr className="border-b border-border">
            <th className={tableHeaderClass}>CRS</th>
            <th className={tableHeaderClass}>min X</th>
            <th className={tableHeaderClass}>min Y</th>
            <th className={tableHeaderClass}>max X</th>
            <th className={tableHeaderClass}>max Y</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.crs} className="border-b border-border/50">
              <td className={tableCellClass}>{row.crs}</td>
              {row.bounds.map((bound, index) => (
                <td
                  key={index}
                  className={`${tableCellClass} font-mono tabular-nums`}
                >
                  {formatNumber(bound)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      {extent.approximate ? (
        <p className="m-0 text-xs text-muted-foreground">
          This is the extent of the layer as drawn on the map. JupyterGIS could
          not read an extent from the data itself.
        </p>
      ) : null}
    </MetadataSection>
  );
};

function sameBounds(a: number[], b?: number[]): boolean {
  return b !== undefined && a.every((value, index) => value === b[index]);
}
