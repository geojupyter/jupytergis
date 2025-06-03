import {
  IDict,
  IJupyterGISDoc,
  IJupyterGISModel,
  IJupyterGISTracker,
  IJupyterGISWidget
} from '@jupytergis/schema';
import { WidgetTracker } from '@jupyterlab/apputils';
import { ISignal } from '@lumino/signaling';
import { Map } from 'ol';

export { IDict };
export type ValueOf<T> = T[keyof T];

export type JupyterGISTracker = WidgetTracker<IJupyterGISWidget>;

export interface IControlPanelModel {
  disconnect(f: any): void;
  documentChanged: ISignal<IJupyterGISTracker, IJupyterGISWidget | null>;
  filePath: string | undefined;
  jGISModel: IJupyterGISModel | undefined;
  sharedModel: IJupyterGISDoc | undefined;
}

export type activeTab = 'color' | 'radius';

/**
 * Add jupytergisMaps object to the global variables.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    /**
     * Access JupyterGIS map
     */
    jupytergisMaps: { [name: string]: Map };
  }
}
