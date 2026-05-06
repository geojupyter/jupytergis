import { IGrammarSymbologyState, IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { findExprNode } from '@/src/features/layers/symbology/colorRampUtils';
import { grammarToOLStyle } from '@/src/features/layers/symbology/grammar/grammarToOLStyle';
import { useGetSymbology } from '@/src/features/layers/symbology/hooks/useGetSymbology';

export const LegendItem: React.FC<{
  layerId: string;
  model: IJupyterGISModel;
}> = ({ layerId, model }) => {
  const { symbology, isLoading, error } = useGetSymbology({ layerId, model });
  const [content, setContent] = useState<JSX.Element | null>(null);

  const parseColorStops = (expr: any): { value: number; color: string }[] => {
    const interpolate = findExprNode(expr, 'interpolate');
    if (!interpolate) {
      return [];
    }
    const stops: { value: number; color: string }[] = [];
    for (let i = 3; i < interpolate.length; i += 2) {
      const value = interpolate[i] as number;
      const rgba = interpolate[i + 1] as
        | [number, number, number, number]
        | string;
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
    const state = symbology.symbologyState;

    // Heatmap legend
    if (renderType === 'Heatmap') {
      const colors = Array.isArray(symbology.symbologyState?.gradient)
        ? symbology.symbologyState.gradient
        : [];
      if (!colors.length) {
        setContent(<p style={{ fontSize: '0.8em' }}>No heatmap colors</p>);
        return;
      }

      const gradient = `linear-gradient(to right, ${colors.join(', ')})`;
      const reversed = symbology.symbologyState?.reverseRamp;

      setContent(
        <div style={{ padding: 6, width: '90%' }}>
          <div style={{ fontSize: '1em', marginBottom: 10 }}>
            <strong>Heatmap</strong>
          </div>
          <div
            style={{
              height: 12,
              background: gradient,
              border: '1px solid #ccc',
              borderRadius: 3,
              marginBottom: 4,
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75em',
              marginBottom: 8,
            }}
          >
            <span style={{ fontWeight: 'bold' }}>Low</span>
            <span style={{ fontWeight: 'bold' }}>High</span>
          </div>
          {reversed && (
            <span style={{ fontSize: '0.75em', fontWeight: 'bold' }}>
              Reversed ramp
            </span>
          )}
        </div>,
      );
      return;
    }

    // Grammar legend — compile to OL flat style and parse the expressions.
    if (renderType === 'Grammar' && state) {
      const computedStyle = grammarToOLStyle(
        state as IGrammarSymbologyState,
        [],
      );

      const toColorString = (v: unknown): string | undefined => {
        if (typeof v === 'string') {
          return v;
        }
        if (
          Array.isArray(v) &&
          v.length === 4 &&
          v.every(x => typeof x === 'number')
        ) {
          return `rgba(${v[0]},${v[1]},${v[2]},${v[3]})`;
        }
        return undefined;
      };

      const rawFill =
        computedStyle?.['fill-color'] ?? computedStyle?.['circle-fill-color'];
      const rawStroke =
        computedStyle?.['stroke-color'] ??
        computedStyle?.['circle-stroke-color'];

      // Graduated-style: interpolate expression → gradient bar
      const gradStops = parseColorStops(rawFill ?? rawStroke);
      if (gradStops.length >= 2) {
        const segments = gradStops
          .map((s, i) => {
            const pct = (i / (gradStops.length - 1)) * 100;
            return `${s.color} ${pct}%`;
          })
          .join(', ');
        setContent(
          <div style={{ padding: 6, width: '90%' }}>
            <div
              style={{
                position: 'relative',
                height: 12,
                background: `linear-gradient(to right, ${segments})`,
                border: '1px solid #ccc',
                borderRadius: 3,
                marginBottom: 20,
                marginTop: 10,
              }}
            >
              {gradStops.map((s, i) => {
                const left = (i / (gradStops.length - 1)) * 100;
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
              })}
            </div>
          </div>,
        );
        return;
      }

      // Categorized-style: case expression → swatch list
      const cats = parseCaseCategories(rawFill ?? rawStroke);
      if (cats.length > 0) {
        setContent(
          <div style={{ padding: 6 }}>
            <div
              style={{
                display: 'grid',
                gap: 6,
                maxHeight: 200,
                overflowY: 'auto',
                paddingRight: 4,
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
                    {String(c.category)}
                  </span>
                </div>
              ))}
            </div>
          </div>,
        );
        return;
      }

      // Constant / simple symbol
      const fill = toColorString(rawFill);
      const stroke = toColorString(rawStroke);
      if (fill || stroke) {
        setContent(
          <div
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 6 }}
          >
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
          </div>,
        );
        return;
      }
    }

    setContent(<p style={{ fontSize: '0.8em' }}>No symbology</p>);
  }, [symbology, isLoading, error]);

  return <div>{content}</div>;
};
