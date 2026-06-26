import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  IGrammarLayer,
  IGrammarSymbologyState,
  IKDETransform,
  IJupyterGISModel,
  IPredicate,
  RGBA,
} from '@jupytergis/schema';
import { jupyterTheme } from '@jupyterlab/codemirror';
import React, { useEffect, useRef, useState } from 'react';

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
  /**
   * How tick positions are computed along the colour bar.
   * 'index'  — equal visual spacing (default; correct for log/non-linear scales)
   * 'value'  — linear interpolation of data values; auto-subsamples to avoid overlap
   */
  tickMode?: 'index' | 'value';
  /** Significant digits for tick labels (default 2) */
  sigDigits?: number;
  /**
   * Fixed text labels rendered flush-left and flush-right below the bar
   * (e.g. ['Low', 'High'] for density).  Replaces numeric tick marks.
   */
  endLabels?: [string, string];
  /**
   * When true a checkerboard pattern is shown behind the bar to indicate
   * that alpha (transparency) varies across the gradient.
   */
  withAlpha?: boolean;
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
  field?: string;
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

type ExpressionEntry = {
  type: 'expression';
  field?: string;
  channel?: string;
  when?: string;
  expr: string;
};

type LegendEntry =
  | GradientEntry
  | CategoricalEntry
  | SwatchEntry
  | SizeEntry
  | StrokeWidthEntry
  | ExpressionEntry;

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
// Value formatting
// ---------------------------------------------------------------------------

/**
 * Format a numeric tick value using at most `sigDigits` significant digits.
 * Uses exponential notation for very large or very small values.
 */
function formatTickValue(v: number, sigDigits: number): string {
  if (v === 0) {
    return '0';
  }
  const abs = Math.abs(v);
  if (abs >= 0.01 && abs < 1e6) {
    return parseFloat(v.toPrecision(sigDigits)).toString();
  }
  return v.toExponential(sigDigits - 1);
}

/** Linearly interpolate a scalar mapping's output at a given stop value. */
function interpolateScalar(
  scalarStops: { stop: number; output: number }[],
  value: number,
): number {
  if (scalarStops.length === 0) {
    return 1;
  }
  if (value <= scalarStops[0].stop) {
    return scalarStops[0].output;
  }
  if (value >= scalarStops[scalarStops.length - 1].stop) {
    return scalarStops[scalarStops.length - 1].output;
  }
  for (let i = 0; i < scalarStops.length - 1; i++) {
    const lo = scalarStops[i];
    const hi = scalarStops[i + 1];
    if (value >= lo.stop && value <= hi.stop) {
      const t = (value - lo.stop) / (hi.stop - lo.stop);
      return lo.output + t * (hi.output - lo.output);
    }
  }
  return 1;
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

  // Pixel channels (raster / KDE).
  if (set.has('pixel-color')) {
    return 'pixel-rgba';
  }
  if (set.has('pixel-rgb')) {
    return 'pixel-rgb';
  }
  if (set.has('pixel-red')) {
    return 'pixel-red';
  }
  if (set.has('pixel-green')) {
    return 'pixel-green';
  }
  if (set.has('pixel-blue')) {
    return 'pixel-blue';
  }
  if (set.has('pixel-alpha')) {
    return 'pixel-alpha';
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
    case 'fieldCompare':
      return `${p.field} ${p.op} ${p.value}`;
    case 'between':
      return `${p.field} between ${p.min} and ${p.max}`;
    default:
      throw new Error(`Invalid predicate type ${p}`);
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
  'pixel-color', // full RGBA (shown as "pixel-rgba" in the UI)
  'pixel-rgb', // virtual: fans out to pixel-red/green/blue
  'pixel-red',
  'pixel-green',
  'pixel-blue',
  'pixel-alpha',
]);

const SIZE_CHANNELS = new Set(['circle-radius']);
const STROKE_WIDTH_CHANNELS = new Set(['stroke-width', 'circle-stroke-width']);

function kdeToLegendEntries(
  grammarLayer: IGrammarLayer,
  kdeTransform: IKDETransform,
): LegendEntry[] {
  const entries: LegendEntry[] = [];

  // "Normalized density" or "Normalized density (weight: <field>)" as the input descriptor.
  const densityLabel = kdeTransform.weightField
    ? `Normalized density (weight: ${kdeTransform.weightField})`
    : 'Normalized density';

  for (const rule of grammarLayer.rules) {
    for (const mapping of rule.mappings) {
      const isPixelChannel = (mapping.channels as string[]).some(
        ch => ch === 'pixel-color' || ch.startsWith('pixel-'),
      );
      if (!isPixelChannel || mapping.scale.scheme !== 'colorRamp') {
        continue;
      }
      const p = mapping.scale.params;
      if (p.colorStops && p.colorStops.length >= 2) {
        const colorStrs = p.colorStops.map(s => rgbaToString(s.color));
        entries.push({
          type: 'gradient',
          field: densityLabel,
          channel: 'Heatmap color',
          colors: colorStrs,
          stops: p.colorStops.map((s, i) => ({
            value: s.stop,
            color: colorStrs[i],
          })),
          tickMode: 'value',
        });
      } else {
        // No stops yet — OL normalizes density to [0, 1].
        const colors = rampColors(p.name);
        const ramp = p.reverse ? [...colors].reverse() : colors;
        entries.push({
          type: 'gradient',
          field: densityLabel,
          channel: 'Heatmap color',
          colors: ramp,
          stops: [
            { value: 0, color: ramp[0] },
            { value: 1, color: ramp[ramp.length - 1] },
          ],
        });
      }
    }
  }

  // Fallback when no colorRamp rule is found.
  if (entries.length === 0) {
    const colors = ['#00f', '#0ff', '#0f0', '#ff0', '#f00'];
    entries.push({
      type: 'gradient',
      field: densityLabel,
      channel: 'Heatmap color',
      colors,
      stops: [
        { value: 0, color: colors[0] },
        { value: 1, color: colors[colors.length - 1] },
      ],
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

    // Look for a pixel-alpha scalar mapping anywhere in this grammar layer.
    // It is often in a separate rule from the color mapping (e.g. COG layers).
    const layerAlphaMapping = grammarLayer.rules
      .flatMap(r => r.mappings)
      .find(
        m =>
          (m.channels as string[]).includes('pixel-alpha') &&
          m.scale.scheme === 'scalar' &&
          (m.scale.params?.scalarStops?.length ?? 0) >= 2,
      );
    const layerAlphaScalarStops: { stop: number; output: number }[] =
      (layerAlphaMapping?.scale as any)?.params?.scalarStops ?? [];

    const layerWhen = grammarLayer.when ?? [];
    for (const rule of grammarLayer.rules) {
      const field = rule.fields?.[0];
      const allWhen = [...layerWhen, ...(rule.when ?? [])];
      const whenLbl = formatWhen(allWhen.length > 0 ? allWhen : undefined);

      for (const mapping of rule.mappings) {
        const { scale, channels } = mapping;

        // Determine which logical channel family this mapping targets.
        const isColor = channels.some(ch => COLOR_CHANNELS.has(ch as string));
        const isSize = channels.some(ch => SIZE_CHANNELS.has(ch as string));
        const isStrokeWidth = channels.some(ch =>
          STROKE_WIDTH_CHANNELS.has(ch as string),
        );

        // Skip the alpha mapping itself — it's shown implicitly via withAlpha.
        if ((channels as string[]).includes('pixel-alpha')) {
          continue;
        }

        const channelLbl = deriveChannelLabel(channels as string[]);
        const isPixelChannel = (channels as string[]).some(
          ch => ch === 'pixel-color' || ch.startsWith('pixel-'),
        );
        const withAlpha = isPixelChannel && layerAlphaScalarStops.length >= 2;

        if (isColor) {
          switch (scale.scheme) {
            case 'colorRamp': {
              const p = scale.params;
              if (p.colorStops && p.colorStops.length >= 2) {
                // When alpha is driven by a companion scalar, clip the displayed
                // gradient and ticks to the scalar's effective domain — beyond
                // it alpha is either 0 (invisible) or constant (fully opaque),
                // so the meaningful field range is [alphaMin, alphaMax].
                let displayStops = p.colorStops;
                if (withAlpha && layerAlphaScalarStops.length >= 2) {
                  const alphaMin = layerAlphaScalarStops[0].stop;
                  const alphaMax =
                    layerAlphaScalarStops[layerAlphaScalarStops.length - 1]
                      .stop;
                  const clipped = p.colorStops.filter(
                    s => s.stop >= alphaMin && s.stop <= alphaMax,
                  );
                  if (clipped.length >= 2) {
                    displayStops = clipped;
                  }
                }
                const colorStrs = displayStops.map(s => {
                  const [r, g, b] = s.color;
                  const a = withAlpha
                    ? interpolateScalar(layerAlphaScalarStops, s.stop)
                    : s.color[3];
                  return `rgba(${r},${g},${b},${a})`;
                });
                entries.push({
                  type: 'gradient',
                  field,
                  channel: channelLbl,
                  when: whenLbl,
                  colors: colorStrs,
                  stops: displayStops.map((s, i) => ({
                    value: s.stop,
                    color: colorStrs[i],
                  })),
                  withAlpha,
                });
              } else {
                // No colorStops yet — show a preview gradient from the ramp name.
                const colors = rampColors(p.name);
                const preview: GradientEntry = {
                  type: 'gradient',
                  field,
                  channel: channelLbl,
                  when: whenLbl,
                  colors,
                  withAlpha,
                };
                if (p.domain) {
                  // Domain is known: show min/max ticks.
                  preview.stops = [
                    { value: p.domain[0], color: colors[0] },
                    { value: p.domain[1], color: colors[colors.length - 1] },
                  ];
                } else {
                  // No domain yet: label the ends so users know the scale exists.
                  preview.endLabels = ['min', 'max'];
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
            case 'identity': {
              // Field value is used as-is for the channel color.
              // No fixed range to display — show a rainbow swatch indicating
              // the channel is data-driven.
              entries.push({
                type: 'swatch',
                field,
                label: channelLbl,
                color:
                  'linear-gradient(to right,#f66,#fa0,#ff0,#6c6,#08f,#94f)',
                when: whenLbl,
              });
              break;
            }
            case 'expression': {
              const p = scale.params;
              entries.push({
                type: 'expression',
                field,
                channel: channelLbl,
                when: whenLbl,
                expr: p.expr,
              });
              break;
            }
            // constant_num on color channel: skip.
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

const CHECKERBOARD: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 3,
  backgroundImage: 'repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%)',
  backgroundSize: '8px 8px',
};

/** Small square swatch with checkerboard backing to reveal alpha. */
const ColorSwatch: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 14,
}) => (
  <span
    style={{
      position: 'relative',
      display: 'inline-block',
      flexShrink: 0,
      width: size,
      height: size,
      borderRadius: 2,
      border: '1px solid #000',
      overflow: 'hidden',
    }}
  >
    <span style={CHECKERBOARD} />
    <span style={{ position: 'absolute', inset: 0, background: color }} />
  </span>
);

const GradientLegend: React.FC<GradientEntry> = ({
  field,
  channel,
  when,
  colors,
  stops,
  tickMode = 'index',
  sigDigits = 2,
  endLabels,
  withAlpha,
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(entries => {
      setBarWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gradient = `linear-gradient(to right, ${colors.join(', ')})`;

  // Determine which stops are visible as ticks.
  let visibleStops = stops ?? [];
  if (stops && stops.length >= 2 && tickMode === 'value' && barWidth > 0) {
    // Estimate the width of the widest label and subsample to avoid overlap.
    const charPx = 6;
    const minGapPx = 4;
    const maxLabelPx =
      Math.max(...stops.map(s => formatTickValue(s.value, sigDigits).length)) *
        charPx +
      minGapPx;
    const maxTicks = Math.max(2, Math.floor(barWidth / maxLabelPx));
    if (stops.length > maxTicks) {
      visibleStops = Array.from(
        { length: maxTicks },
        (_, i) => stops[Math.round((i * (stops.length - 1)) / (maxTicks - 1))],
      );
    }
  }

  const min = visibleStops.length >= 2 ? visibleStops[0].value : 0;
  const max =
    visibleStops.length >= 2 ? visibleStops[visibleStops.length - 1].value : 1;
  const valueRange = max - min || 1;

  return (
    <div style={{ padding: '6px 6px 10px' }}>
      <EntryHeader field={field} channel={channel} when={when} />
      <div ref={barRef} style={{ marginBottom: 4 }}>
        <div style={{ position: 'relative', height: 12 }}>
          {withAlpha && <div style={CHECKERBOARD} />}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: gradient,
              border: '1px solid #ccc',
              borderRadius: 3,
            }}
          />
        </div>
        {visibleStops.length >= 2 && (
          <div style={{ position: 'relative', height: 18, marginTop: 2 }}>
            {visibleStops.map((s, i) => {
              const pct =
                tickMode === 'value'
                  ? ((s.value - min) / valueRange) * 100
                  : (i / (visibleStops.length - 1)) * 100;
              const isFirst = i === 0;
              const isLast = i === visibleStops.length - 1;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    transform: isFirst
                      ? 'none'
                      : isLast
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isFirst
                      ? 'flex-start'
                      : isLast
                        ? 'flex-end'
                        : 'center',
                  }}
                >
                  <div style={{ width: 1, height: 4, background: '#888' }} />
                  <div style={{ fontSize: '0.7em', whiteSpace: 'nowrap' }}>
                    {formatTickValue(s.value, sigDigits)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {endLabels && !visibleStops.length && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.7em',
              marginTop: 2,
            }}
          >
            <span>{endLabels[0]}</span>
            <span>{endLabels[1]}</span>
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
          <ColorSwatch color={s.color || '#ccc'} />
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

const SwatchLegend: React.FC<SwatchEntry> = ({ field, label, color, when }) => (
  <div style={{ padding: '4px 6px' }}>
    <EntryHeader field={field} channel={label} when={when} />
    <ColorSwatch color={color} />
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

const ExpressionLegend: React.FC<ExpressionEntry> = ({
  field,
  channel,
  when,
  expr,
}) => {
  const [expanded, setExpanded] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isLong = expr.length > 80;

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    viewRef.current?.destroy();

    const state = EditorState.create({
      doc: expr,
      extensions: [
        javascript(),
        jupyterTheme,

        EditorView.editable.of(false),
        EditorView.lineWrapping,
        EditorView.theme({
          '&.cm-editor': {
            fontSize: '1em',
          },
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div style={{ padding: 6 }}>
      <EntryHeader field={field} channel={channel} when={when} />

      <div
        ref={editorRef}
        style={{
          overflow: 'hidden',
          maxHeight: expanded ? 'none' : '3em',
        }}
      />
      {isLong && (
        <div style={{ marginTop: 2 }}>
          <span
            onClick={() => setExpanded(v => !v)}
            style={{
              fontSize: '0.90em',
              cursor: 'pointer',
              color: 'var(--jp-content-font-color2)',
              userSelect: 'none',
            }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </span>
        </div>
      )}
    </div>
  );
};

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

    if (Array.isArray(state.layers)) {
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
          case 'expression': {
            return <ExpressionLegend key={i} {...entry} />;
          }
        }
      })}
    </div>
  );
};
