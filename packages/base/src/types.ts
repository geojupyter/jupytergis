import {
  IDict,
  IJupyterGISDoc,
  IJupyterGISModel,
  IJupyterGISTracker,
  IJupyterGISWidget
} from '@jupytergis/schema';
import { ISignal } from '@lumino/signaling';

export { IDict };
export type ValueOf<T> = T[keyof T];

export interface IControlPanelModel {
  disconnect(f: any): void;
  documentChanged: ISignal<IJupyterGISTracker, IJupyterGISWidget | null>;
  filePath: string | undefined;
  jGISModel: IJupyterGISModel | undefined;
  sharedModel: IJupyterGISDoc | undefined;
}
