import _ProcessingMerge from './_generated/processing_merge.json';

type ProcessingElement = {
  description: string;
  gen_name: string;
  gen_params: string[];
  gen_label: string;
  gen_type: string;
  gen_additionals: any;
};
export const GEN_TYPE = {
  vector: 'vector',
};

export const ProcessingMerge = _ProcessingMerge as ProcessingElement[];
