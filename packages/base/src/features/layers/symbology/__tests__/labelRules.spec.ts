/**
 * The label editor shows one row but stores five grammar rules, so what
 * matters is that reading and writing are inverses and that neither disturbs
 * the ordinary symbology rules sharing the same list.
 */

import { IGrammarRow } from '../components/MappingRow';
import {
  defaultLabelConfig,
  isLabelRow,
  readLabel,
  removeLabel,
  writeLabel,
} from '../labelRules';

const fillRow: IGrammarRow = {
  id: 'fill',
  scale: { scheme: 'constant_rgba', params: { value: [1, 2, 3, 1] } },
  encodings: ['fill-color'],
};

const strokeRow: IGrammarRow = {
  id: 'stroke',
  scale: { scheme: 'constant_num', params: { value: 2 } },
  encodings: ['stroke-width'],
};

describe('labelRules', () => {
  it('reports no label on a layer that has none', () => {
    expect(readLabel([fillRow, strokeRow])).toBeNull();
  });

  it('round-trips a label through the rules and back', () => {
    const config = {
      ...defaultLabelConfig('name'),
      fontSize: 16,
      fontFamily: 'serif',
      color: [10, 20, 30, 1] as [number, number, number, number],
      outlineWidth: 4,
    };
    const rows = writeLabel([fillRow], config);
    expect(readLabel(rows)).toEqual(config);
  });

  it('writes the five rules a label needs', () => {
    const rows = writeLabel([], defaultLabelConfig('name'));
    expect(rows.flatMap(r => r.encodings)).toEqual([
      'text-value',
      'text-font',
      'text-fill-color',
      'text-stroke-color',
      'text-stroke-width',
    ]);
  });

  it('drops the outline rules when the outline is switched off', () => {
    const rows = writeLabel([], {
      ...defaultLabelConfig('name'),
      outline: false,
    });
    expect(rows.flatMap(r => r.encodings)).toEqual([
      'text-value',
      'text-font',
      'text-fill-color',
    ]);
    expect(readLabel(rows)?.outline).toBe(false);
  });

  it('leaves ordinary symbology rules untouched and in order', () => {
    const rows = writeLabel([fillRow, strokeRow], defaultLabelConfig('name'));
    expect(rows.filter(r => !isLabelRow(r))).toEqual([fillRow, strokeRow]);
    expect(removeLabel(rows)).toEqual([fillRow, strokeRow]);
  });

  it('reuses rule ids so edits do not churn the document', () => {
    const first = writeLabel([], defaultLabelConfig('name'));
    const second = writeLabel(first, {
      ...defaultLabelConfig('name'),
      fontSize: 20,
    });
    expect(second.map(r => r.id)).toEqual(first.map(r => r.id));
  });

  it('keeps the label in place rather than moving it to the end', () => {
    const withLabel = writeLabel([fillRow], defaultLabelConfig('name'));
    const reordered = [...withLabel, strokeRow];
    const edited = writeLabel(reordered, {
      ...defaultLabelConfig('name'),
      fontSize: 20,
    });
    // fill first, then the label, then stroke — the label did not jump.
    expect(edited[0]).toEqual(fillRow);
    expect(edited[edited.length - 1]).toEqual(strokeRow);
  });

  it('falls back to defaults for a font shorthand it cannot represent', () => {
    const rows = writeLabel([], defaultLabelConfig('name')).map(r =>
      r.encodings.includes('text-font')
        ? {
            ...r,
            scale: {
              scheme: 'constant_str' as const,
              params: { value: 'bold 14pt Helvetica' },
            },
          }
        : r,
    );
    const read = readLabel(rows);
    expect(read?.fontSize).toBe(12);
    expect(read?.fontFamily).toBe('sans-serif');
  });
});
