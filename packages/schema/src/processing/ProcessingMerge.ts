import { IDict } from '../interfaces';
import _ProcessingMerge from './_generated/processing_merge.json';

type ProcessingElement = {
  description: string;
  processName: string;
  processParams: string[];
  processLabel: string;
  processType: string;
  processAdditionalsParams: any;
};
export const ProcessingLogicType = {
  vector: 'vector',
};

export const ProcessingMerge = _ProcessingMerge as ProcessingElement[];

export const ProcessingCommandIDs: IDict = {};

for (const e of ProcessingMerge) {
  ProcessingCommandIDs[e.processName] = `jupytergis:${e.processName}`;
}
