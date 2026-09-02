/**
 * Reading and writing labels as grammar rules.
 *
 * A label is five encodings that only mean anything together: the text, the
 * font, the fill colour, and the colour and width of the outline drawn behind
 * the text so it stays readable over a busy basemap. Grammar rules are the
 * storage format, but nobody wants to assemble a label out of five of them, so
 * the UI edits one label and this module translates.
 *
 * Anything the label editor does not model (per-feature fonts, text-align,
 * data-driven placement) is still expressible by hand in the document and is
 * left alone by the read/write round trip.
 */

import { Encoding, RGBA } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';

import { IGrammarRow } from '@/src/features/layers/symbology/components/MappingRow';

/** Encodings the label editor owns. */
const LABEL_ENCODINGS = new Set<Encoding>([
  'text-value',
  'text-font',
  'text-fill-color',
  'text-stroke-color',
  'text-stroke-width',
]);

export const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace'] as const;

export const DEFAULT_LABEL_COLOR: RGBA = [0, 0, 0, 1];
export const DEFAULT_OUTLINE_COLOR: RGBA = [255, 255, 255, 1];
export const DEFAULT_OUTLINE_WIDTH = 3;
export const DEFAULT_FONT_SIZE = 12;

export interface ILabelConfig {
  /** Attribute whose value becomes the label. */
  field?: string;
  fontSize: number;
  fontFamily: string;
  color: RGBA;
  /** Draw a contrasting outline behind the text. */
  outline: boolean;
  outlineColor: RGBA;
  outlineWidth: number;
}

export function defaultLabelConfig(field?: string): ILabelConfig {
  return {
    field,
    fontSize: DEFAULT_FONT_SIZE,
    fontFamily: 'sans-serif',
    color: DEFAULT_LABEL_COLOR,
    outline: true,
    outlineColor: DEFAULT_OUTLINE_COLOR,
    outlineWidth: DEFAULT_OUTLINE_WIDTH,
  };
}

/** True when this row is part of a label rather than ordinary symbology. */
export function isLabelRow(row: IGrammarRow): boolean {
  return row.encodings.some(c => LABEL_ENCODINGS.has(c));
}

function rowFor(
  rows: IGrammarRow[],
  encoding: Encoding,
): IGrammarRow | undefined {
  return rows.find(row => row.encodings.includes(encoding));
}

/**
 * Split a CSS font shorthand back into a size and a family.
 *
 * Only the "<size>px <family>" shape the editor writes is parsed. Anything
 * else (a font with a weight, a family the dropdown does not list) falls back
 * to the defaults for display, and is overwritten the moment the user touches
 * the control — which is the honest outcome, since the editor cannot represent
 * it.
 */
function parseFont(font: string | undefined): {
  fontSize: number;
  fontFamily: string;
} {
  const match = font?.match(/^\s*(\d+(?:\.\d+)?)px\s+(.+?)\s*$/);
  if (!match) {
    return { fontSize: DEFAULT_FONT_SIZE, fontFamily: 'sans-serif' };
  }
  return { fontSize: Number(match[1]), fontFamily: match[2] };
}

/** Read the label out of a layer's rows, or null when there is none. */
export function readLabel(rows: IGrammarRow[]): ILabelConfig | null {
  const textRow = rowFor(rows, 'text-value');
  if (!textRow) {
    return null;
  }

  const fontRow = rowFor(rows, 'text-font');
  const colorRow = rowFor(rows, 'text-fill-color');
  const outlineColorRow = rowFor(rows, 'text-stroke-color');
  const outlineWidthRow = rowFor(rows, 'text-stroke-width');

  const font =
    fontRow?.scale.scheme === 'constant_str'
      ? fontRow.scale.params.value
      : undefined;
  const outlineWidth =
    outlineWidthRow?.scale.scheme === 'constant_num'
      ? outlineWidthRow.scale.params.value
      : DEFAULT_OUTLINE_WIDTH;
  // The outline is off when its rules are absent, not merely when the width
  // reads as zero: with no rules at all the width falls back to the default,
  // which would otherwise switch the outline back on by itself.
  const hasOutlineRules =
    outlineWidthRow !== undefined || outlineColorRow !== undefined;

  return {
    field: textRow.fields?.[0],
    ...parseFont(font),
    color:
      colorRow?.scale.scheme === 'constant_rgba'
        ? colorRow.scale.params.value
        : DEFAULT_LABEL_COLOR,
    // A zero-width outline draws nothing, so treat it as switched off rather
    // than showing a control that has no effect.
    outline: hasOutlineRules && outlineWidth > 0,
    outlineColor:
      outlineColorRow?.scale.scheme === 'constant_rgba'
        ? outlineColorRow.scale.params.value
        : DEFAULT_OUTLINE_COLOR,
    outlineWidth: outlineWidth > 0 ? outlineWidth : DEFAULT_OUTLINE_WIDTH,
  };
}

/**
 * Replace a layer's label rows with ones matching `config`, leaving every
 * other row untouched and in place.
 *
 * Existing rule ids are reused so that React keys, and the story-segment
 * override merging that keys off rule ids, stay stable across edits.
 */
export function writeLabel(
  rows: IGrammarRow[],
  config: ILabelConfig,
): IGrammarRow[] {
  const idFor = (encoding: Encoding) =>
    rowFor(rows, encoding)?.id ?? UUID.uuid4();

  const labelRows: IGrammarRow[] = [
    {
      id: idFor('text-value'),
      ...(config.field ? { fields: [config.field] } : {}),
      scale: { scheme: 'identity' },
      encodings: ['text-value'],
    },
    {
      id: idFor('text-font'),
      scale: {
        scheme: 'constant_str',
        params: { value: `${config.fontSize}px ${config.fontFamily}` },
      },
      encodings: ['text-font'],
    },
    {
      id: idFor('text-fill-color'),
      scale: { scheme: 'constant_rgba', params: { value: config.color } },
      encodings: ['text-fill-color'],
    },
  ];

  if (config.outline) {
    labelRows.push(
      {
        id: idFor('text-stroke-color'),
        scale: {
          scheme: 'constant_rgba',
          params: { value: config.outlineColor },
        },
        encodings: ['text-stroke-color'],
      },
      {
        id: idFor('text-stroke-width'),
        scale: {
          scheme: 'constant_num',
          params: { value: config.outlineWidth },
        },
        encodings: ['text-stroke-width'],
      },
    );
  }

  // Keep the label where it already was so that toggling the outline off and
  // on again does not shuffle the rule order in the saved document.
  const firstLabelIndex = rows.findIndex(isLabelRow);
  const others = rows.filter(row => !isLabelRow(row));
  if (firstLabelIndex === -1) {
    return [...others, ...labelRows];
  }
  const before = others.slice(
    0,
    rows.slice(0, firstLabelIndex).filter(row => !isLabelRow(row)).length,
  );
  const after = others.slice(before.length);
  return [...before, ...labelRows, ...after];
}

/** Remove every row belonging to the label. */
export function removeLabel(rows: IGrammarRow[]): IGrammarRow[] {
  return rows.filter(row => !isLabelRow(row));
}
