import { BaseForm, IBaseFormProps} from '../baseform';
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

    this.state = {
      schema: options.schema ?? {}
    };
  }
}
