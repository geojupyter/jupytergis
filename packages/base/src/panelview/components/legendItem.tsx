import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { useGetSymbology } from '@/src/dialogs/symbology/hooks/useGetSymbology';

export const LegendItem: React.FC<{
  layerId: string;
  model: IJupyterGISModel;
}> = ({ layerId, model }) => {
  const { symbology, isLoading, error } = useGetSymbology({ layerId, model });
  const [content, setContent] = useState<JSX.Element | null>(null);

  const parseColorStops = (expr: any): { value: number; color: string }[] => {
    if (!Array.isArray(expr) || expr[0] !== 'interpolate') {
      return [];
    }
    const stops: { value: number; color: string }[] = [];
    for (let i = 3; i < expr.length; i += 2) {
      const value = expr[i] as number;
      const rgba = expr[i + 1] as [number, number, number, number] | string;
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
    if (!Array.isArray(expr) || expr[0] !== 'case') {
      return [];
    }
    const categories: { category: string | number; color: string }[] = [];
    for (let i = 1; i < expr.length - 1; i += 2) {
      const condition = expr[i];
      const colorExpr = expr[i + 1];
      let category: any = '';
      if (Array.isArray(condition) && condition[0] === '==') {
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

  useEffect(() => {
    if (isLoading) {
      setContent(<p style={{ fontSize: '0.8em' }}>Loading…</p>);
      return;
    }
    if (error) {
      setContent(
        <p style={{ color: 'red', fontSize: '0.8em' }}>{error.message}</p>,
      );
      return;
    }
    if (!symbology) {
      setContent(<p style={{ fontSize: '0.8em' }}>No symbology</p>);
      return;
    }

    const renderType = symbology.symbologyState?.renderType;
    const fill =
      symbology.color?.['fill-color'] ?? symbology.color?.['circle-fill-color'];
    const stroke =
      symbology.color?.['stroke-color'] ??
      symbology.color?.['circle-stroke-color'];

    // Single Symbol
    if (renderType === 'Single Symbol') {
      setContent(
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 6 }}>
          {fill && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: '1px solid #000',
                  background: fill,
                }}
              />
              <span style={{ fontSize: '0.8em' }}>Fill</span>
            </div>
          )}
          {stroke && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 24,
                  height: 2,
                  background: stroke,
                  border: '1px solid #000',
                }}
              />
              <span style={{ fontSize: '0.8em' }}>Stroke</span>
            </div>
          )}
          {!fill && !stroke && (
            <span style={{ fontSize: '0.8em' }}>No symbol colors</span>
          )}
        </div>,
      );
      return;
    }

    // Graduated
    if (renderType === 'Graduated') {
      const stops = parseColorStops(fill || stroke);
      if (!stops.length) {
        setContent(<p style={{ fontSize: '0.8em' }}>No graduated symbology</p>);
        return;
      }
      const values = stops.map(s => s.value);
      const colors = stops.map(s => s.color);
      const ranges: string[] = [];
      for (let i = 0; i < values.length; i++) {
        if (i === 0) {
          ranges.push(`< ${values[0].toFixed(2)}`);
        } else if (i === values.length - 1) {
          ranges.push(`> ${values[values.length - 1].toFixed(2)}`);
        } else {
          ranges.push(`${values[i - 1].toFixed(2)} – ${values[i].toFixed(2)}`);
        }
      }
      setContent(
        <div style={{ display: 'grid', gap: 6, padding: 6 }}>
          {ranges.map((label, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  background: colors[i] || '#ccc',
                  border: '1px solid #000',
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: '0.75em' }}>{label}</span>
            </div>
          ))}
        </div>,
      );
      return;
    }

    // Categorized
    if (renderType === 'Categorized') {
      const cats = parseCaseCategories(fill || stroke);
      if (!cats.length) {
        setContent(
          <p style={{ fontSize: '0.8em' }}>No categorized symbology</p>,
        );
        return;
      }

      const n = cats.length;
      const tickCount = Math.min(6, n); // limit ticks (e.g. 6 max)
      const tickIdx = Array.from({ length: tickCount }, (_, i) =>
        Math.round((i * (n - 1)) / (tickCount - 1)),
      );
      const uniqueIdx = Array.from(new Set(tickIdx));
      const labeled = uniqueIdx.map(i => ({ ...cats[i], idx: i }));

      const segments = cats
        .map((c, i) => {
          const start = (i * 100) / n;
          const end = ((i + 1) * 100) / n;
          return `${c.color} ${start}% ${end}%`;
        })
        .join(', ');
      const gradient = `linear-gradient(to right, ${segments})`;

      setContent(
        <div style={{ padding: 6, width: '90%' }}>
          <div
            style={{
              position: 'relative',
              height: 12,
              background: gradient,
              border: '1px solid #ccc',
              borderRadius: 3,
              marginBottom: 20,
              marginTop: 10,
            }}
          >
            {labeled.map((c, i) => {
              const left = (c.idx * 100) / (n - 1);
              const up = i % 2 === 0;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div
                    style={{
                      width: 1,
                      height: 8,
                      background: '#333',
                      margin: '0 auto',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: up ? -18 : 12,
                      fontSize: '0.7em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {String(c.category)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
      );
      return;
    }

    setContent(<p>Unsupported symbology: {String(renderType)}</p>);
  }, [symbology, isLoading, error]);

  return <div>{content}</div>;
};
