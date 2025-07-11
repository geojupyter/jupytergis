import { IDict } from '../interfaces';
import _ProcessingMerge from './_generated/processing_merge.json';

type ProcessingElement = {
  description: string;
  name: string;
  operationParams: string[];
  label: string;
  type: string;
  operations: any;
};
export const ProcessingLogicType = {
  vector: 'vector',
};

export const ProcessingMerge = _ProcessingMerge as ProcessingElement[];

export const ProcessingCommandIDs: IDict = {};

for (const e of ProcessingMerge) {
  ProcessingCommandIDs[e.name] = `jupytergis:${e.name}`;
}
