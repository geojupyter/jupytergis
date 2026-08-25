import * as React from 'react';

import { IBandMetadata, IPyramidMetadata, IVectorMetadata } from '../types';
import { MetadataSection } from './MetadataSection';
import { formatNumber, formatRange } from '../utils/format';

const cellClass = 'px-2 py-1 text-left align-top';
const headerClass = `${cellClass} font-medium text-muted-foreground`;

/**
 * A horizontally scrollable table, so a wide band list never forces the dialog
 * itself to scroll sideways.
 */
const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-xs">{children}</table>
  </div>
);

/**
 * One row per band, with whatever the format could tell us about it.
 */
export const BandTable: React.FC<{ bands: IBandMetadata[] }> = ({ bands }) => {
  const hasDataType = bands.some(band => band.dataType);
  const hasColorInterpretation = bands.some(band => band.colorInterpretation);
  const hasNoData = bands.some(band => band.noData !== undefined);
  const hasRange = bands.some(
    band => band.minimum !== undefined || band.maximum !== undefined,
  );

  return (
    <MetadataSection
      title="Bands"
      summary={`${bands.length} band${bands.length === 1 ? '' : 's'}`}
    >
      <Table>
        <thead>
          <tr className="border-b border-border">
            <th className={headerClass}>#</th>
            <th className={headerClass}>Name</th>
            {hasDataType ? <th className={headerClass}>Type</th> : null}
            {hasColorInterpretation ? (
              <th className={headerClass}>Colour</th>
            ) : null}
            {hasNoData ? <th className={headerClass}>No data</th> : null}
            {hasRange ? <th className={headerClass}>Value range</th> : null}
          </tr>
        </thead>
        <tbody>
          {bands.map(band => (
            <tr key={band.band} className="border-b border-border/50">
              <td className={cellClass}>{band.band}</td>
              <td className={cellClass}>{band.name}</td>
              {hasDataType ? (
                <td className={`${cellClass} font-mono`}>
                  {band.dataType ?? '—'}
                </td>
              ) : null}
              {hasColorInterpretation ? (
                <td className={cellClass}>{band.colorInterpretation ?? '—'}</td>
              ) : null}
              {hasNoData ? (
                <td className={`${cellClass} font-mono`}>
                  {band.noData ?? '—'}
                </td>
              ) : null}
              {hasRange ? (
                <td className={`${cellClass} font-mono`}>
                  {formatRange(band.minimum, band.maximum) ?? '—'}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
    </MetadataSection>
  );
};

/**
 * The internal tile pyramid: overviews inside a file, or the zoom range of a
 * tiled web service.
 */
export const PyramidTable: React.FC<{ pyramid: IPyramidMetadata }> = ({
  pyramid,
}) => {
  const { levels, minZoom, maxZoom, tiled, tileWidth, tileHeight } = pyramid;

  const summary = levels.length
    ? `${levels.length} level${levels.length === 1 ? '' : 's'}`
    : undefined;

  return (
    <MetadataSection title="Tile pyramid" summary={summary}>
      {tiled !== undefined || tileWidth ? (
        <p className="m-0 text-xs text-muted-foreground">
          {tiled
            ? `Internally tiled${tileWidth && tileHeight ? ` at ${tileWidth} × ${tileHeight} pixels` : ''}.`
            : 'Not internally tiled, so partial reads are less efficient.'}
        </p>
      ) : null}

      {minZoom !== undefined || maxZoom !== undefined ? (
        <p className="m-0 text-xs text-muted-foreground">
          Served for zoom levels {minZoom ?? '—'} to {maxZoom ?? '—'}.
        </p>
      ) : null}

      {levels.length ? (
        <Table>
          <thead>
            <tr className="border-b border-border">
              <th className={headerClass}>Level</th>
              <th className={headerClass}>Size</th>
              <th className={headerClass}>Downsampling</th>
            </tr>
          </thead>
          <tbody>
            {levels.map(level => (
              <tr
                key={`${level.level}-${level.name ?? ''}`}
                className="border-b border-border/50"
              >
                <td className={cellClass}>
                  {level.name ?? (level.level === 0 ? 'Full' : level.level)}
                </td>
                <td className={`${cellClass} font-mono`}>
                  {level.width && level.height
                    ? `${level.width} × ${level.height}`
                    : '—'}
                </td>
                <td className={`${cellClass} font-mono`}>
                  {level.scale ? `1 : ${formatNumber(level.scale)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </MetadataSection>
  );
};

/**
 * Feature count, geometry types and the attribute table's columns.
 */
export const VectorTable: React.FC<{ vector: IVectorMetadata }> = ({
  vector,
}) => {
  const { featureCount, geometryTypes, fields } = vector;

  return (
    <MetadataSection
      title="Features"
      summary={
        featureCount === undefined
          ? undefined
          : `${featureCount} feature${featureCount === 1 ? '' : 's'}`
      }
    >
      {geometryTypes?.length ? (
        <p className="m-0 text-xs text-muted-foreground">
          Geometry: {geometryTypes.join(', ')}.
        </p>
      ) : null}

      {fields?.length ? (
        <Table>
          <thead>
            <tr className="border-b border-border">
              <th className={headerClass}>Attribute</th>
              <th className={headerClass}>Type</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(field => (
              <tr key={field.name} className="border-b border-border/50">
                <td className={cellClass}>{field.name}</td>
                <td className={`${cellClass} font-mono`}>{field.type}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </MetadataSection>
  );
};
