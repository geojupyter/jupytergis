import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { getColorMapList } from '@/src/dialogs/symbology/colorRampUtils';
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
    const property = symbology.symbologyState?.value;
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

      const rampName = symbology.symbologyState?.colorRamp;
      const rampDef = rampName
        ? getColorMapList().find(c => c.name === rampName)
        : undefined;

      const segments = stops
        .map((s, i) => {
          const pct = (i / (stops.length - 1)) * 100;
          return `${s.color} ${pct}%`;
        })
        .join(', ');
      const gradient = `linear-gradient(to right, ${segments})`;

      const dataMin = symbology.symbologyState?.dataMin ?? stops[0].value;
      const dataMax =
        symbology.symbologyState?.dataMax ?? stops[stops.length - 1].value;

      let criticalValue: number | undefined = undefined;
      if (rampDef?.definition.type === 'Divergent') {
        const relativeCritical = rampDef.criticalValue ?? 0.5;
        criticalValue = dataMin + relativeCritical * (dataMax - dataMin);
      }
      const isDivergent = criticalValue !== undefined;

      setContent(
        <div style={{ padding: 6, width: '90%' }}>
          {property && (
            <div style={{ fontSize: '1em', marginBottom: 20 }}>
              <strong>{property}</strong>
            </div>
          )}
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
            {!isDivergent ? (
              stops.map((s, i) => {
                const left = (i / (stops.length - 1)) * 100;
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
                        marginTop: up ? 0 : 4,
                      }}
                    >
                      {s.value.toFixed(2)}
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                {/* Min */}
                <div
                  style={{
                    position: 'absolute',
                    left: '0%',
                    transform: 'translateX(0%)',
                    fontWeight: 'bold',
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
                    style={{ position: 'absolute', top: 12, fontSize: '0.7em' }}
                  >
                    {dataMin.toFixed(2)}
                  </div>
                </div>

                {/* Max */}
                <div
                  style={{
                    position: 'absolute',
                    left: '100%',
                    transform: 'translateX(-100%)',
                    fontWeight: 'bold',
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
                    style={{ position: 'absolute', top: 12, fontSize: '0.7em' }}
                  >
                    {dataMax.toFixed(2)}
                  </div>
                </div>

                {/* Critical */}
                {isDivergent && criticalValue !== undefined && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${
                        criticalValue <= dataMin
                          ? 0
                          : criticalValue >= dataMax
                            ? 100
                            : ((criticalValue - dataMin) /
                                (dataMax - dataMin)) *
                              100
                      }%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div
                      style={{
                        width: 2,
                        height: 14,
                        background: 'red',
                        margin: '0 auto',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: -20,
                        fontSize: '0.7em',
                        fontWeight: 'bold',
                      }}
                    >
                      {criticalValue.toFixed(1)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
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

      const numericCats = cats
        .map(c => (typeof c.category === 'number' ? c.category : NaN))
        .filter(v => !isNaN(v));

      const minValue = numericCats.length
        ? Math.min(...numericCats)
        : undefined;
      const maxValue = numericCats.length
        ? Math.max(...numericCats)
        : undefined;

      setContent(
        <div style={{ padding: 6 }}>
          {property && (
            <div style={{ fontSize: '1em', marginBottom: 6 }}>
              <strong>{property}</strong>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gap: 6,
              maxHeight: 200,
              overflowY: 'auto',
              paddingRight: 4,
              marginBottom: 12,
            }}
          >
            {cats.map((c, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    background: c.color || '#ccc',
                    border: '1px solid #000',
                    borderRadius: 2,
                  }}
                />
                <span style={{ fontSize: '0.75em' }}>
                  {typeof c.category === 'number'
                    ? c.category.toFixed(2)
                    : String(c.category)}
                </span>
              </div>
            ))}
          </div>

          {/* Min/Max */}
          {(minValue !== undefined || maxValue !== undefined) && (
            <div
              style={{ fontSize: '0.75em', color: '#555', fontWeight: 'bold' }}
            >
              {minValue !== undefined && <div>Min: {minValue}</div>}
              {maxValue !== undefined && <div>Max: {maxValue}</div>}
            </div>
          )}
        </div>,
      );
      return;
    }

    setContent(<p>Unsupported symbology: {String(renderType)}</p>);
  }, [symbology, isLoading, error]);

  return <div>{content}</div>;
};
