import React from 'react';

const DRAW_GEOMETRIES = ['Point', 'LineString', 'Polygon'] as const;

export interface IMainViewOverlayLayerProps {
  annotationFloaters: React.ReactNode;
  featureFloaters: React.ReactNode;
  editingVectorLayer: boolean;
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
}

export function MainViewOverlayLayer({
  annotationFloaters,
  featureFloaters,
  editingVectorLayer,
  drawGeometryLabel,
  onDrawGeometryTypeChange,
}: IMainViewOverlayLayerProps): JSX.Element {
  return (
    <>
      {annotationFloaters}
      {featureFloaters}
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
