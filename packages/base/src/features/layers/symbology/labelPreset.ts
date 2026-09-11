import { UUID } from '@lumino/coreutils';

import { IGrammarRow } from '@/src/features/layers/symbology/components/MappingRow';

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_FONT_FAMILY = 'sans-serif';
const DEFAULT_LABEL_COLOR: [number, number, number, number] = [0, 0, 0, 1];

/**
 * The mappings that make up a label, as one rule.
 *
 * The halo is left out on purpose: the compiler draws a white one whenever
 * text-value is mapped and no halo rule overrides it.
 */
export function defaultLabelRows(field?: string): IGrammarRow[] {
  const ruleId = UUID.uuid4();
  return [
    {
      id: UUID.uuid4(),
      ruleId,
      ...(field ? { fields: [field] } : {}),
      scale: { scheme: 'identity' },
      encodings: ['text-value'],
    },
    {
      id: UUID.uuid4(),
      ruleId,
      scale: { scheme: 'constant_num', params: { value: DEFAULT_FONT_SIZE } },
      encodings: ['text-font-size'],
    },
    {
      id: UUID.uuid4(),
      ruleId,
      scale: {
        scheme: 'constant_str',
        params: { value: DEFAULT_FONT_FAMILY },
      },
      encodings: ['text-font-family'],
    },
    {
      id: UUID.uuid4(),
      ruleId,
      scale: {
        scheme: 'constant_rgba',
        params: { value: DEFAULT_LABEL_COLOR },
      },
      encodings: ['text-fill-color'],
    },
  ];
}
