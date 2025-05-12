import * as React from 'react';

export function VectorLayerDropdown() {
  const handlegeometryTypeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    console.log('To be implemented');
  };
  const vectorLayers = ['Point', 'LineString', 'Polygon', 'Circle'];
  return (
    <div className="geometry-type-selector-container">
      <select
        className="geometry-type-selector"
        id="geometry-type-selector"
        value={''}
        onChange={handlegeometryTypeChange}
      >
        <option value="" selected hidden>
          Geometry type
        </option>
        {vectorLayers.map(geometryType => (
          <option key={geometryType} value={geometryType}>
            {geometryType}
          </option>
        ))}
      </select>
    </div>
  );
}
