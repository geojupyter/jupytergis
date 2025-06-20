import {
  ProcessingType,
  processingList,
  ProcessingMerge,
  IDict,
} from '@jupytergis/schema';

export function processingFormToParam(
  formValues: IDict,
  processingType: ProcessingType,
) {
  if (!processingList.includes(processingType)) {
    console.error(`Unsupported processing type: ${processingType}`);
    return;
  }

  const processingElement = ProcessingMerge.find(
    e => e.description === processingType,
  );

  const params = processingElement!.processParams;

  const out: IDict = {};

  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    out[param] = formValues[param];
  }

  return out;
}
