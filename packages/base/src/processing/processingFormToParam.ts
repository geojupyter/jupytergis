import { ProcessingMerge, IDict } from '@jupytergis/schema';

import { ProcessingType, ProcessingList } from './_generated/processingType';

export function processingFormToParam(
  formValues: IDict,
  processingType: ProcessingType,
) {
  if (!ProcessingList.includes(processingType)) {
    console.error(`Unsupported processing type: ${processingType}`);
    return;
  }

  const processingElement = ProcessingMerge.find(
    e => e.description === processingType,
  );

  const params = processingElement!.gen_params;

  const out: IDict = {};

  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    out[param] = formValues[param];
  }

  return out;
}
