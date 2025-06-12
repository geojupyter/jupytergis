import _ProcessingMerge from './_generated/processing_merge.json';

type ProcessingElement = {
  description: string;
  processName: string;
  processParams: string[];
  processLabel: string;
  processType: string;
  processAdditionalsParams: any;
};
export const GEN_TYPE = {
  vector: 'vector',
};

export const ProcessingMerge = _ProcessingMerge as ProcessingElement[];
