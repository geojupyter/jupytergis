import React from 'react';

import compassRoseNSvgStr from '../../../style/icons/compass_rose/N.svg';
import compassRoseArrowSvgStr from '../../../style/icons/compass_rose/arrow.svg';

const DRAW_GEOMETRIES = ['Point', 'LineString', 'Polygon'] as const;

export interface IMainViewOverlayLayerProps {
  annotationFloaters: React.ReactNode;
  featureFloaters: React.ReactNode;
  editingVectorLayer: boolean;
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
  rotation: number;
  onResetRotation: () => void;
}

export function MainViewOverlayLayer({
  annotationFloaters,
  featureFloaters,
  editingVectorLayer,
  drawGeometryLabel,
  onDrawGeometryTypeChange,
  rotation,
  onResetRotation,
}: IMainViewOverlayLayerProps): JSX.Element {
  return (
    <>
      {annotationFloaters}
      {featureFloaters}
      {rotation !== 0 ? (
        <div className="jgis-compass-rose-overlay" onClick={onResetRotation}>
          <div
            className="jgis-compass-rose-arrow"
            style={{ transform: `rotate(${rotation}rad)` }}
            dangerouslySetInnerHTML={{ __html: compassRoseArrowSvgStr }}
          />
          <div
            className="jgis-compass-rose-n"
            dangerouslySetInnerHTML={{ __html: compassRoseNSvgStr }}
          />
        </div>
      ) : null}
      {editingVectorLayer ? (
        <div className="jgis-geometry-type-selector-overlay">
          <select
            className="geometry-type-selector"
            id="geometry-type-selector"
            value={drawGeometryLabel ?? ''}
            onChange={onDrawGeometryTypeChange}
          >
            <option value="" disabled hidden>
              Geometry type
            </option>
            {DRAW_GEOMETRIES.map(geometryType => (
              <option key={geometryType} value={geometryType}>
                {geometryType}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}
