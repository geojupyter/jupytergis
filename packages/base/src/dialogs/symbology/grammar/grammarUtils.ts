import { UUID } from '@lumino/coreutils';

import { FieldType, IColorRampScale, IEncodingRule, IScale, OLStyleChannel } from './types';

// ---------------------------------------------------------------------------
// Channel groups
// ---------------------------------------------------------------------------

export const COLOR_CHANNELS: OLStyleChannel[] = [
  'fill-color',
  'stroke-color',
  'circle-fill-color',
  'circle-stroke-color',
];

export const NUMERIC_CHANNELS: OLStyleChannel[] = [
  'stroke-width',
  'circle-radius',
  'circle-stroke-width',
];

export const ALL_CHANNELS: OLStyleChannel[] = [
  ...COLOR_CHANNELS,
  ...NUMERIC_CHANNELS,
];

export const CHANNEL_LABELS: Record<OLStyleChannel, string> = {
  'fill-color': 'Fill Color',
  'stroke-color': 'Stroke Color',
  'circle-fill-color': 'Marker Fill',
  'circle-stroke-color': 'Marker Stroke',
  'stroke-width': 'Stroke Width',
  'circle-radius': 'Marker Size',
  'circle-stroke-width': 'Marker Stroke Width',
};

// ---------------------------------------------------------------------------
// Type system: input / output types for scales and channels
// ---------------------------------------------------------------------------

/**
 * The value type a channel expects to receive.
 *   color  → fill-color, stroke-color, circle-fill-color, circle-stroke-color
 *   number → stroke-width, circle-radius, circle-stroke-width
 */
export type ChannelValueType = 'color' | 'number';

/**
 * The value type a scale produces.
 *   color  → colorRamp, categorical
 *   number → scalar
 *   any    → constant (depends on user-supplied value), identity (pass-through)
 */
export type ScaleOutputType = 'color' | 'number' | 'any';

export function channelType(channel: OLStyleChannel): ChannelValueType {
  return (COLOR_CHANNELS as OLStyleChannel[]).includes(channel) ? 'color' : 'number';
}

export function scaleOutputType(scheme: IScale['scheme']): ScaleOutputType {
  switch (scheme) {
    case 'colorRamp':
    case 'categorical':
      return 'color';
    case 'scalar':
      return 'number';
    case 'constant':
    case 'identity':
      return 'any';
  }
}

/**
 * Returns true when the scale's output type is compatible with the channel.
 * 'any' scales (constant, identity) are always compatible.
 */
export function isSchemeCompatible(
  scheme: IScale['scheme'],
  channel: OLStyleChannel,
): boolean {
  const out = scaleOutputType(scheme);
  if (out === 'any') {
    return true;
  }
  return out === channelType(channel);
}

// ---------------------------------------------------------------------------
// Categorical palette
// ---------------------------------------------------------------------------

/** Colors from ColorBrewer Set1, used for auto-assigning categorical values. */
export const CATEGORICAL_PALETTE = [
  '#e41a1c',
  '#377eb8',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
  '#a65628',
  '#f781bf',
  '#999999',
  '#ffff33',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function inferFieldType(values: Set<any>): FieldType {
  const arr = Array.from(values).filter(v => v !== null && v !== undefined);
  if (arr.length === 0) {
    return 'nominal';
  }
  const numericCount = arr.filter(
    v => typeof v === 'number' && isFinite(v),
  ).length;
  return numericCount > arr.length / 2 ? 'quantitative' : 'nominal';
}

export function computeDomain(values: Set<any>): [number, number] {
  const nums = Array.from(values)
    .map(v => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter(v => isFinite(v));
  if (nums.length === 0) {
    return [0, 1];
  }
  return [Math.min(...nums), Math.max(...nums)];
}

export function defaultColorRampScale(values: Set<any>): IColorRampScale {
  return {
    scheme: 'colorRamp',
    name: 'viridis',
    domain: computeDomain(values),
    nShades: 9,
    mode: 'equal interval',
    reverse: false,
    fallback: [0, 0, 0, 0],
  };
}

export function defaultScaleForChannel(
  channel: OLStyleChannel,
  field: string,
  featureProperties: Record<string, Set<any>>,
): IScale {
  if (channelType(channel) === 'number') {
    const values = featureProperties[field] ?? new Set();
    return {
      scheme: 'scalar',
      domain: computeDomain(values),
      range: [0, 10],
      mode: 'equal interval',
      nStops: 9,
      fallback: 0,
    };
  }
  return defaultScale(field, featureProperties);
}

export function defaultScale(
  field: string,
  featureProperties: Record<string, Set<any>>,
): IScale {
  const values = featureProperties[field] ?? new Set();
  const fieldType = inferFieldType(values);

  if (fieldType === 'quantitative') {
    return defaultColorRampScale(values);
  }

  // nominal/ordinal: build categorical mapping with auto-assigned colors
  const mapping: Record<string, string> = {};
  Array.from(values)
    .slice(0, 20)
    .forEach((v, i) => {
      mapping[String(v)] = CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length];
    });
  return {
    scheme: 'categorical',
    mapping,
    fallback: 'rgba(0,0,0,0)',
  };
}

export function createDefaultRule(
  featureProperties: Record<string, Set<any>>,
  existingRules: IEncodingRule[],
): IEncodingRule {
  const fields = Object.keys(featureProperties);
  const field = fields[0] ?? '';
  const usedChannels = new Set(existingRules.map(r => r.channel));
  const channel =
    COLOR_CHANNELS.find(c => !usedChannels.has(c)) ?? 'fill-color';

  return {
    id: UUID.uuid4(),
    field,
    channel,
    scale: defaultScaleForChannel(channel, field, featureProperties),
  };
}
