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

  const parseColorStops = (expr: any): { value: number; color: string }[] => {
    if (!Array.isArray(expr) || expr[0] !== 'interpolate') {return [];}
    const stops: { value: number; color: string }[] = [];
    for (let i = 3; i < expr.length; i += 2) {
      const value = expr[i] as number;
      const rgba = expr[i + 1] as [number, number, number, number];
      const color = Array.isArray(rgba)
        ? `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3]})`
        : String(rgba);
      stops.push({ value, color });
    }
    return stops;
  };

  const parseCaseCategories = (
    expr: any,
  ): { category: string | number; color: string }[] => {
    if (!Array.isArray(expr) || expr[0] !== 'case') {return [];}

    const categories: { category: string | number; color: string }[] = [];

    for (let i = 1; i < expr.length - 1; i += 2) {
      const condition = expr[i];
      const colorExpr = expr[i + 1];


      let category;
      if (
        Array.isArray(condition) &&
        condition[0] === '==' &&
        Array.isArray(condition[2])
      ) {
        category = condition[2];
      } else if (Array.isArray(condition) && condition[0] === '==') {
        category = condition[2];
      }


      let color = '';
      if (Array.isArray(colorExpr)) {
        color = `rgba(${colorExpr[0]},${colorExpr[1]},${colorExpr[2]},${colorExpr[3]})`;
      } else if (typeof colorExpr === 'string') {
        color = colorExpr;
      }

      categories.push({ category, color });
    }

    return categories;
  };

  const renderLegend = () => {
    if (!symbology) {return <p>No symbology available</p>;}

    const state = symbology.symbologyState?.renderType;

    if (state === 'Single Symbol') {
      const color =
        symbology.color?.['fill-color'] || symbology.color?.['stroke-color'];
      return (
        <div
          className="legend-item"
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <span
            className="legend-color"
            style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              marginRight: '8px',
              backgroundColor: color,
              border: '1px solid #000',
            }}
          />
          <span>Layer</span>
        </div>
      );
    }

    if (state === 'Graduated') {
      const stops = parseColorStops(
        symbology.color?.['fill-color'] || symbology.color?.['stroke-color'],
      );
      if (stops.length === 0) {return <p>No graduated symbology</p>;}

      return (
        <>
          {stops.map((stop, idx) => (
            <div
              key={idx}
              className="legend-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
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
          ))}
        </>
      );
    }

    if (state === 'Categorized') {
      const categories = parseCaseCategories(
        symbology.color?.['fill-color'] || symbology.color?.['stroke-color'],
      );
      if (categories.length === 0) {return <p>No categorized symbology</p>;}

      return (
        <div style={{ padding: '4px 0' }}>
          {categories.map((c, idx) => (
            <div
              key={idx}
              className="legend-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span
                className="legend-color"
                style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  marginRight: '8px',
                  backgroundColor: c.color,
                  border: '1px solid #000',
                }}
              />
              <span className="legend-label">{String(c.category)}</span>
            </div>
          ))}
        </div>
      );
    }

    return <p>Unsupported render type: {state}</p>;
  };

  return (
    <Draggable handle=".legends-header">
      <div
        className={`legends-container ${collapsed ? 'collapsed' : ''}`}
        style={{
          position: 'absolute',
          top: '100px',
          left: '100px',
          background: 'white',
          border: '1px solid #ccc',
          padding: '8px',
          minWidth: '180px',
        }}
      >
        {/* Header */}
        <div
          className="legends-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            cursor: 'move',
          }}
        >
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
            {!isLoading && renderLegend()}
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default Legends;
