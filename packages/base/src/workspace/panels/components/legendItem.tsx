import {
  IGrammarLayer,
  IGrammarSymbologyState,
  IKDETransform,
  IJupyterGISModel,
  IPredicate,
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
  /** Human-readable output channel label, e.g. "Fill color" */
  channel?: string;
  /** Human-readable filter from the rule's when clause */
  when?: string;
  /** CSS colour strings ordered from min to max */
  colors: string[];
  /** Explicit stop breakpoints (value + colour) when available */
  stops?: { value: number; color: string }[];
};

type CategoricalEntry = {
  type: 'categorical';
  field?: string;
  channel?: string;
  when?: string;
  stops: { label: string; color: string }[];
};

type SwatchEntry = {
  type: 'swatch';
  label: string;
  color: string;
  when?: string;
};

type SizeEntry = {
  type: 'size';
  field?: string;
  channel?: string;
  when?: string;
  minSize: number;
  maxSize: number;
  domain: [number, number];
};

type StrokeWidthEntry = {
  type: 'stroke-width';
  field?: string;
  channel?: string;
  when?: string;
  minWidth: number;
  maxWidth: number;
  domain: [number, number];
};

type LegendEntry =
  | GradientEntry
  | CategoricalEntry
  | SwatchEntry
  | SizeEntry
  | StrokeWidthEntry;

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
  return Array.from(
    { length: n },
    (_, i) => colors[Math.round(i * step)] as string,
  );
}

// ---------------------------------------------------------------------------
// Channel label helpers
// ---------------------------------------------------------------------------

/**
 * Derive a single human-readable label for a set of output channels.
 * Multiple channels often cover the same logical property for different
 * geometry types (e.g. fill-color + circle-fill-color → "Fill color").
 */
function deriveChannelLabel(channels: string[]): string {
  const set = new Set(channels);

  // Colour channels — combine geometry variants where both are present.
  const hasFillPoly = set.has('fill-color');
  const hasFillCircle = set.has('circle-fill-color');
  const hasStrokeColorLine = set.has('stroke-color');
  const hasStrokeColorCircle = set.has('circle-stroke-color');
  const hasFill = hasFillPoly || hasFillCircle;
  const hasStrokeColor = hasStrokeColorLine || hasStrokeColorCircle;

  if (hasFill && hasStrokeColor) {
    return 'Fill & stroke color';
  }
  if (hasFill) {
    if (hasFillPoly && hasFillCircle) {
      return 'Fill color';
    }
    return hasFillPoly ? 'Fill color (polygon)' : 'Fill color (circle)';
  }
  if (hasStrokeColor) {
    if (hasStrokeColorLine && hasStrokeColorCircle) {
      return 'Stroke color';
    }
    return hasStrokeColorLine ? 'Stroke color (line)' : 'Stroke color (circle)';
  }

  // Width channels.
  const hasWidthLine = set.has('stroke-width');
  const hasWidthCircle = set.has('circle-stroke-width');
  if (hasWidthLine && hasWidthCircle) {
    return 'Stroke width';
  }
  if (hasWidthLine) {
    return 'Stroke width (line)';
  }
  if (hasWidthCircle) {
    return 'Stroke width (circle)';
  }

  if (set.has('circle-radius')) {
    return 'Radius';
  }
  if (set.has('pixel-color') || channels.some(c => c.startsWith('pixel-'))) {
    return 'Color';
  }
  return channels[0] ?? '';
}

/** Format a single predicate into a short human-readable string. */
function formatPredicate(p: IPredicate): string {
  switch (p.type) {
    case 'geometryType':
      return p.value;
    case 'hasField':
      return `has ${p.field}`;
    case 'fieldEquals':
      return `${p.field} = ${p.value}`;
  }
}

/** Format a when clause (AND-ed predicates) into a single string. */
function formatWhen(when: IPredicate[] | undefined): string | undefined {
  if (!when || when.length === 0) {
    return undefined;
  }
  return when.map(formatPredicate).join(' & ');
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
const STROKE_WIDTH_CHANNELS = new Set(['stroke-width', 'circle-stroke-width']);

function kdeToLegendEntries(
  grammarLayer: IGrammarLayer,
  kdeTransform: IKDETransform,
): LegendEntry[] {
  const entries: LegendEntry[] = [];

  // Label: "Density" or "Density (weight: <field>)" when a weight field is set.
  const densityLabel = kdeTransform.weightField
    ? `Density (weight: ${kdeTransform.weightField})`
    : 'Density';

  for (const rule of grammarLayer.rules) {
    for (const mapping of rule.mappings) {
      const isPixelChannel = (mapping.channels as string[]).some(
        ch => ch === 'pixel-color' || ch.startsWith('pixel-'),
      );
      if (!isPixelChannel || mapping.scale.scheme !== 'colorRamp') {
        continue;
      }
      const p = mapping.scale.params;
      const colors = rampColors(p.name);
      entries.push({
        type: 'gradient',
        field: densityLabel,
        colors: p.reverse ? [...colors].reverse() : colors,
      });
    }
  }

  // Fallback: emit a plain gradient with the default heatmap palette when no
  // pixel-color colorRamp rule is present.
  if (entries.length === 0) {
    entries.push({
      type: 'gradient',
      field: densityLabel,
      colors: ['#00f', '#0ff', '#0f0', '#ff0', '#f00'],
    });
  }

  return entries;
}

function grammarToLegendEntries(state: IGrammarSymbologyState): LegendEntry[] {
  const entries: LegendEntry[] = [];

  for (const grammarLayer of state.layers ?? []) {
    const kdeTransform = grammarLayer.preprocess?.find(
      (t): t is IKDETransform => t.type === 'kde',
    );

    if (kdeTransform) {
      entries.push(...kdeToLegendEntries(grammarLayer, kdeTransform));
      continue;
    }

    for (const rule of grammarLayer.rules) {
      const field = rule.fields?.[0];
      const whenLbl = formatWhen(rule.when);

      for (const mapping of rule.mappings) {
        const { scale, channels } = mapping;

        // Determine which logical channel family this mapping targets.
        const isColor = channels.some(ch => COLOR_CHANNELS.has(ch as string));
        const isSize = channels.some(ch => SIZE_CHANNELS.has(ch as string));
        const isStrokeWidth = channels.some(ch =>
          STROKE_WIDTH_CHANNELS.has(ch as string),
        );

        const channelLbl = deriveChannelLabel(channels as string[]);

        if (isColor) {
          switch (scale.scheme) {
            case 'colorRamp': {
              const p = scale.params;
              if (p.colorStops && p.colorStops.length >= 2) {
                entries.push({
                  type: 'gradient',
                  field,
                  channel: channelLbl,
                  when: whenLbl,
                  colors: p.colorStops.map(s => rgbaToString(s.color)),
                  stops: p.colorStops.map(s => ({
                    value: s.stop,
                    color: rgbaToString(s.color),
                  })),
                });
              } else {
                // No data yet — generate preview from ramp name.
                const colors = rampColors(p.name);
                const preview: GradientEntry = {
                  type: 'gradient',
                  field,
                  channel: channelLbl,
                  when: whenLbl,
                  colors,
                };
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
              const p = scale.params;
              if (p.colorStops && p.colorStops.length > 0) {
                entries.push({
                  type: 'categorical',
                  field,
                  channel: channelLbl,
                  when: whenLbl,
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
              entries.push({
                type: 'swatch',
                label: channelLbl,
                color,
                when: whenLbl,
              });
              break;
            }
            // identity / expression / constant_num on color channel: skip.
            default:
              break;
          }
        } else if (isSize && scale.scheme === 'scalar') {
          const p = scale.params;
          entries.push({
            type: 'size',
            field,
            channel: channelLbl,
            when: whenLbl,
            minSize: p.range[0],
            maxSize: p.range[1],
            domain: p.domain,
          });
        } else if (isStrokeWidth && scale.scheme === 'scalar') {
          const p = scale.params;
          entries.push({
            type: 'stroke-width',
            field,
            channel: channelLbl,
            when: whenLbl,
            minWidth: p.range[0],
            maxWidth: p.range[1],
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

/**
 * Shared header shown above every data-driven legend entry.
 *
 *   best_age_top          ← input field (bold)
 *   → Stroke width        ← output channel (muted)
 *   if: Polygon           ← when clause (muted, only when present)
 */
const EntryHeader: React.FC<{
  field?: string;
  channel?: string;
  when?: string;
}> = ({ field, channel, when }) => {
  if (!field && !channel && !when) {
    return null;
  }
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: '0 4px',
        marginBottom: 6,
        fontSize: '0.78em',
      }}
    >
      {field && <span style={{ fontWeight: 'bold' }}>{field}</span>}
      {channel && <span style={{ opacity: 0.7 }}>→ {channel}</span>}
      {when && <span style={{ opacity: 0.6 }}>· if: {when}</span>}
    </div>
  );
};

const GradientLegend: React.FC<GradientEntry> = ({
  field,
  channel,
  when,
  colors,
  stops,
}) => {
  const gradient = `linear-gradient(to right, ${colors.join(', ')})`;
  return (
    <div style={{ padding: '6px 6px 10px' }}>
      <EntryHeader field={field} channel={channel} when={when} />
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
              const pct =
                ((s.value - stops[0].value) /
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
                    style={{
                      width: 1,
                      height: 6,
                      background: '#666',
                      margin: '0 auto',
                    }}
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

const CategoricalLegend: React.FC<CategoricalEntry> = ({
  field,
  channel,
  when,
  stops,
}) => (
  <div style={{ padding: 6 }}>
    <EntryHeader field={field} channel={channel} when={when} />
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
          <span
            style={{
              fontSize: '0.75em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const SwatchLegend: React.FC<SwatchEntry> = ({ label, color, when }) => (
  <div style={{ padding: '4px 6px' }}>
    <EntryHeader channel={label} when={when} />
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '1px solid #000',
        background: color,
        flexShrink: 0,
      }}
    />
  </div>
);

const SizeLegend: React.FC<SizeEntry> = ({
  field,
  channel,
  when,
  minSize,
  maxSize,
  domain,
}) => (
  <div style={{ padding: 6 }}>
    <EntryHeader field={field} channel={channel} when={when} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
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

const StrokeWidthLegend: React.FC<StrokeWidthEntry> = ({
  field,
  channel,
  when,
  minWidth,
  maxWidth,
  domain,
}) => (
  <div style={{ padding: 6 }}>
    <EntryHeader field={field} channel={channel} when={when} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {[
        { w: minWidth, v: domain[0] },
        { w: maxWidth, v: domain[1] },
      ].map(({ w, v }, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              width: 28,
              height: Math.max(1, w),
              background: '#888',
              border: '1px solid #333',
            }}
          />
          <span style={{ fontSize: '0.7em' }}>
            {v % 1 === 0 ? v : v.toFixed(1)}
          </span>
        </div>
      ))}
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
      setEntries(grammarToLegendEntries(state as IGrammarSymbologyState));
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
    return (
      <HeatmapLegend gradient={heatmapColors} reversed={heatmapReversed} />
    );
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
          case 'stroke-width':
            return <StrokeWidthLegend key={i} {...entry} />;
        }
      })}
    </div>
  );
};
