import {
  IGrammarSymbologyState,
  IJupyterGISModel,
  RGBA,
} from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import {
  ColorRampName,
  getColorMap,
} from '@/src/features/layers/symbology/colorRampUtils';
import { useGetSymbology } from '@/src/features/layers/symbology/hooks/useGetSymbology';

// ---------------------------------------------------------------------------
// Legend entry types
// ---------------------------------------------------------------------------

type GradientEntry = {
  type: 'gradient';
  field?: string;
  /** CSS colour strings ordered from min to max */
  colors: string[];
  /** Explicit stop breakpoints (value + colour) when available */
  stops?: { value: number; color: string }[];
};

type CategoricalEntry = {
  type: 'categorical';
  field?: string;
  stops: { label: string; color: string }[];
};

type SwatchEntry = {
  type: 'swatch';
  label: string;
  color: string;
};

type SizeEntry = {
  type: 'size';
  field?: string;
  minSize: number;
  maxSize: number;
  domain: [number, number];
};

type LegendEntry = GradientEntry | CategoricalEntry | SwatchEntry | SizeEntry;

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function rgbaToString([r, g, b, a]: RGBA): string {
  return `rgba(${r},${g},${b},${a})`;
}

function rampColors(name: string, n = 7): string[] {
  const map = getColorMap(name as ColorRampName);
  if (!map || !map.colors.length) {
    return ['#000', '#fff'];
  }
  const colors = map.colors;
  if (colors.length <= n) {
    return colors as string[];
  }
  // Sample n evenly-spaced colours from the full ramp.
  const step = (colors.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => colors[Math.round(i * step)] as string);
}

// ---------------------------------------------------------------------------
// Grammar → LegendEntry[]
// ---------------------------------------------------------------------------

const COLOR_CHANNELS = new Set([
  'fill-color',
  'circle-fill-color',
  'stroke-color',
  'circle-stroke-color',
]);

const SIZE_CHANNELS = new Set(['circle-radius']);

function grammarToLegendEntries(state: IGrammarSymbologyState): LegendEntry[] {
  const entries: LegendEntry[] = [];

  for (const grammarLayer of state.layers ?? []) {
    // KDE layers produce a density raster — skip vector legend entries for them.
    if (grammarLayer.preprocess?.some(t => t.type === 'kde')) {
      continue;
    }

    for (const rule of grammarLayer.rules) {
      const field = rule.fields?.[0];

      for (const mapping of rule.mappings) {
        const { scale, channels } = mapping;

        // Determine which logical channel family this mapping targets.
        const isColor = channels.some(ch => COLOR_CHANNELS.has(ch as string));
        const isSize = channels.some(ch => SIZE_CHANNELS.has(ch as string));

        if (isColor) {
          switch (scale.scheme) {
            case 'colorRamp': {
              const p = (scale ).params;
              if (p.colorStops && p.colorStops.length >= 2) {
                entries.push({
                  type: 'gradient',
                  field,
                  colors: p.colorStops.map(s => rgbaToString(s.color)),
                  stops: p.colorStops.map(s => ({
                    value: s.stop,
                    color: rgbaToString(s.color),
                  })),
                });
              } else {
                // No data yet — generate preview from ramp name.
                const colors = rampColors(p.name);
                const preview: GradientEntry = { type: 'gradient', field, colors };
                if (p.domain) {
                  preview.stops = [
                    { value: p.domain[0], color: colors[0] },
                    { value: p.domain[1], color: colors[colors.length - 1] },
                  ];
                }
                entries.push(preview);
              }
              break;
            }
            case 'categorical': {
              const p = (scale ).params;
              if (p.colorStops && p.colorStops.length > 0) {
                entries.push({
                  type: 'categorical',
                  field,
                  stops: p.colorStops.map(s => ({
                    label: String(s.stop),
                    color: rgbaToString(s.color),
                  })),
                });
              }
              // No colorStops → skip (categories not yet loaded).
              break;
            }
            case 'constant_rgba': {
              const color = rgbaToString(scale.params.value);
              // Only emit a swatch for the primary channel to avoid duplicates.
              const ch = channels[0] as string;
              const label =
                ch.includes('fill') ? 'Fill'
                : ch.includes('stroke') ? 'Stroke'
                : ch;
              entries.push({ type: 'swatch', label, color });
              break;
            }
            // identity / expression / constant_num on color channel: skip.
            default:
              break;
          }
        } else if (isSize && scale.scheme === 'scalar') {
          const p = (scale ).params;
          entries.push({
            type: 'size',
            field,
            minSize: p.range[0],
            maxSize: p.range[1],
            domain: p.domain,
          });
        }
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Individual legend entry renderers
// ---------------------------------------------------------------------------

const GradientLegend: React.FC<GradientEntry> = ({ field, colors, stops }) => {
  const gradient = `linear-gradient(to right, ${colors.join(', ')})`;
  return (
    <div style={{ padding: '6px 6px 10px' }}>
      {field && (
        <div style={{ fontSize: '0.78em', fontWeight: 'bold', marginBottom: 6 }}>
          {field}
        </div>
      )}
      <div style={{ position: 'relative', marginBottom: stops ? 20 : 4 }}>
        <div
          style={{
            height: 12,
            background: gradient,
            border: '1px solid #ccc',
            borderRadius: 3,
          }}
        />
        {stops && stops.length >= 2 && (
          <div style={{ position: 'relative', height: 20 }}>
            {stops.map((s, i) => {
              const pct = ((s.value - stops[0].value) /
                (stops[stops.length - 1].value - stops[0].value)) *
                100;
              const above = i % 2 === 0;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div
                    style={{ width: 1, height: 6, background: '#666', margin: '0 auto' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: above ? -16 : 8,
                      fontSize: '0.7em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.value % 1 === 0 ? s.value : s.value.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const CategoricalLegend: React.FC<CategoricalEntry> = ({ field, stops }) => (
  <div style={{ padding: 6 }}>
    {field && (
      <div style={{ fontSize: '0.78em', fontWeight: 'bold', marginBottom: 6 }}>
        {field}
      </div>
    )}
    <div
      style={{
        display: 'grid',
        gap: 4,
        maxHeight: 180,
        overflowY: 'auto',
        paddingRight: 4,
      }}
    >
      {stops.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              flexShrink: 0,
              width: 14,
              height: 14,
              background: s.color || '#ccc',
              border: '1px solid #000',
              borderRadius: 2,
            }}
          />
          <span style={{ fontSize: '0.75em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const SwatchLegend: React.FC<SwatchEntry> = ({ label, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px' }}>
    <span
      style={{
        width: 14,
        height: 14,
        border: '1px solid #000',
        background: color,
        flexShrink: 0,
      }}
    />
    <span style={{ fontSize: '0.78em' }}>{label}</span>
  </div>
);

const SizeLegend: React.FC<SizeEntry> = ({ field, minSize, maxSize, domain }) => (
  <div style={{ padding: 6 }}>
    {field && (
      <div style={{ fontSize: '0.78em', fontWeight: 'bold', marginBottom: 6 }}>
        {field}
      </div>
    )}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span
          style={{
            width: minSize * 2,
            height: minSize * 2,
            borderRadius: '50%',
            background: '#888',
            border: '1px solid #333',
          }}
        />
        <span style={{ fontSize: '0.7em' }}>
          {domain[0] % 1 === 0 ? domain[0] : domain[0].toFixed(1)}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span
          style={{
            width: maxSize * 2,
            height: maxSize * 2,
            borderRadius: '50%',
            background: '#888',
            border: '1px solid #333',
          }}
        />
        <span style={{ fontSize: '0.7em' }}>
          {domain[1] % 1 === 0 ? domain[1] : domain[1].toFixed(1)}
        </span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Heatmap legend
// ---------------------------------------------------------------------------

const HeatmapLegend: React.FC<{ gradient: string[]; reversed?: boolean }> = ({
  gradient,
  reversed,
}) => {
  const bg = `linear-gradient(to right, ${gradient.join(', ')})`;
  return (
    <div style={{ padding: 6, width: '90%' }}>
      <div style={{ fontSize: '0.78em', fontWeight: 'bold', marginBottom: 8 }}>
        Density
      </div>
      <div
        style={{
          height: 12,
          background: bg,
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
        }}
      >
        <span>{reversed ? 'High' : 'Low'}</span>
        <span>{reversed ? 'Low' : 'High'}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main LegendItem component
// ---------------------------------------------------------------------------

export const LegendItem: React.FC<{
  layerId: string;
  model: IJupyterGISModel;
}> = ({ layerId, model }) => {
  const { symbology, isLoading, error } = useGetSymbology({ layerId, model });
  const [entries, setEntries] = useState<LegendEntry[]>([]);
  const [heatmapColors, setHeatmapColors] = useState<string[] | null>(null);
  const [heatmapReversed, setHeatmapReversed] = useState(false);

  useEffect(() => {
    setEntries([]);
    setHeatmapColors(null);

    if (isLoading || error || !symbology) {
      return;
    }

    const state = symbology.symbologyState;
    if (!state) {
      return;
    }

    // Heatmap layers have their own renderType and gradient config.
    if (state.renderType === 'Heatmap') {
      const colors = Array.isArray(state.gradient) ? state.gradient : [];
      if (colors.length) {
        setHeatmapColors(colors);
        setHeatmapReversed(!!state.reverseRamp);
      }
      return;
    }

    if (state.renderType === 'Grammar') {
      setEntries(
        grammarToLegendEntries(state as IGrammarSymbologyState),
      );
    }
  }, [symbology, isLoading, error]);

  if (isLoading) {
    return <p style={{ fontSize: '0.8em', padding: 6 }}>Loading…</p>;
  }
  if (error) {
    return (
      <p style={{ color: 'red', fontSize: '0.8em', padding: 6 }}>
        {error.message}
      </p>
    );
  }

  if (heatmapColors) {
    return <HeatmapLegend gradient={heatmapColors} reversed={heatmapReversed} />;
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <div>
      {entries.map((entry, i) => {
        switch (entry.type) {
          case 'gradient':
            return <GradientLegend key={i} {...entry} />;
          case 'categorical':
            return <CategoricalLegend key={i} {...entry} />;
          case 'swatch':
            return <SwatchLegend key={i} {...entry} />;
          case 'size':
            return <SizeLegend key={i} {...entry} />;
        }
      })}
    </div>
  );
};
