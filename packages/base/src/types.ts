import { IDict, IJupyterGISWidget } from '@jupytergis/schema';
import { WidgetTracker } from '@jupyterlab/apputils';
import { Map } from 'ol';

export { IDict };
export type ValueOf<T> = T[keyof T];

export type JupyterGISTracker = WidgetTracker<IJupyterGISWidget>;

export type SymbologyTab = 'color' | 'radius';

export type VectorRenderType =
  | 'Single Symbol'
  | 'Canonical'
  | 'Graduated'
  | 'Categorized'
  | 'Heatmap';

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
