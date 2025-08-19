import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useState } from 'react';
import Draggable from 'react-draggable';

import { useGetSymbology } from '../dialogs/symbology/hooks/useGetSymbology';

interface ILegendsProps {
  layerId: string;
  model: IJupyterGISModel;
}

const Legends: React.FC<ILegendsProps> = ({ layerId, model }) => {
  const [collapsed, setCollapsed] = useState(false);

  const { symbology, isLoading, error } = useGetSymbology({ layerId, model });
  console.log('symbology', symbology);

  const parseColorStops = (fillColor: any): { value: number; color: string }[] => {
    if (!Array.isArray(fillColor) || fillColor[0] !== 'interpolate') {
      return [];
    }

    const stops: { value: number; color: string }[] = [];
    for (let i = 3; i < fillColor.length; i += 2) {
      const value = fillColor[i] as number;
      const rgba = fillColor[i + 1] as [number, number, number, number];
      const color = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3]})`;
      stops.push({ value, color });
    }
    return stops;
  };

  const stops = parseColorStops(symbology?.color?.['fill-color']);

  return (
    <Draggable handle=".legends-header">
      <div
        className={`legends-container ${collapsed ? 'collapsed' : ''}`}
        style={{ position: 'absolute', top: '100px', left: '100px', background: 'white', border: '1px solid #ccc', padding: '8px' }}
      >
        {/* Header */}
        <div className="legends-header" style={{ display: 'flex', justifyContent: 'space-between', cursor: 'move' }}>
          <span className="legends-title">Legends</span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="legends-toggle"
          >
            {collapsed ? '▾' : '▴'}
          </button>
        </div>

        {/* Body */}
        {!collapsed && (
          <div className="legends-body">
            {isLoading && <p>Loading...</p>}
            {error && <p style={{ color: 'red' }}>{error.message}</p>}

            {!isLoading && symbology ? (
              <>
                {stops.length > 0 ? (
                  stops.map((stop, idx) => (
                    <div key={idx} className="legend-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span
                        className="legend-color"
                        style={{
                          display: 'inline-block',
                          width: '16px',
                          height: '16px',
                          marginRight: '8px',
                          backgroundColor: stop.color,
                          border: '1px solid #000',
                        }}
                      />
                      <span className="legend-label">{stop.value.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p>No symbology available</p>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default Legends;
