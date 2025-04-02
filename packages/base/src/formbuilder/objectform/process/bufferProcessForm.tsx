import { BaseForm, IBaseFormProps } from '../baseform';
import { IDict, IJupyterGISModel } from '@jupytergis/schema';

interface IBufferFormOptions extends IBaseFormProps {
  schema: IDict;
  sourceData: IDict;
  title: string;
  cancelButton: (() => void) | boolean;
  syncData: (props: IDict) => void;
  model: IJupyterGISModel;
}

export class BufferForm extends BaseForm {
  constructor(options: IBufferFormOptions) {
    super(options);

    // Add the embed output checkbox to the schema
    this.state = {
      schema: {
        ...options.schema,
        properties: {
          ...options.schema?.properties
        }
      }
    };
  }
}
