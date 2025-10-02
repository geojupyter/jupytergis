import { IDict, IJupyterGISWidget } from '@jupytergis/schema';
import { WidgetTracker } from '@jupyterlab/apputils';
import { Map } from 'ol';

export { IDict };
export type ValueOf<T> = T[keyof T];

export type JupyterGISTracker = WidgetTracker<IJupyterGISWidget>;

export type SymbologyTab = 'color' | 'radius';

type RgbColorValue =
  | [number, number, number]
  | [number, number, number, number];
type HexColorValue = string;
type InternalRgbArray = number[];

export type ColorValue = RgbColorValue | HexColorValue;

export type SizeValue = number;

export type SymbologyValue = SizeValue | ColorValue | InternalRgbArray;

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

const classificationModes = [
  'quantile',
  'equal interval',
  'jenks',
  'pretty',
  'logarithmic',
  'continuous',
] as const;

export type ClassificationMode = (typeof classificationModes)[number];
