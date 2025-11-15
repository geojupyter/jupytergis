import { IDict, IJupyterGISWidget } from '@jupytergis/schema';
import { WidgetTracker } from '@jupyterlab/apputils';
import { Map } from 'ol';

import { COLOR_RAMP_DEFINITIONS } from '@/src/dialogs/symbology/colorRamps';

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

/**
 * Color ramp types and definitions
 */
export type ColorRampType = 'Sequential' | 'Divergent' | 'Cyclic';

export interface IBaseColorRampDefinition {
  type: ColorRampType;
}

export interface ISequentialColorRampDefinition
  extends IBaseColorRampDefinition {
  type: 'Sequential';
}

export interface IDivergentColorRampDefinition
  extends IBaseColorRampDefinition {
  type: 'Divergent';
  criticalValue: number;
}

export interface ICyclicColorRampDefinition extends IBaseColorRampDefinition {
  type: 'Cyclic';
}

export type IColorRampDefinition =
  | ISequentialColorRampDefinition
  | IDivergentColorRampDefinition
  | ICyclicColorRampDefinition;

export interface IColorMap {
  name: ColorRampName;
  colors: string[];
  definition: IColorRampDefinition;
}

export type ColorRampName = keyof typeof COLOR_RAMP_DEFINITIONS;

export const COLOR_RAMP_DEFAULTS: Partial<Record<ColorRampName, number>> = {
  hsv: 11,
  picnic: 11,
  'rainbow-soft': 11,
  cubehelix: 16,
};
const classificationModes = [
  'quantile',
  'equal interval',
  'jenks',
  'pretty',
  'logarithmic',
  'continuous',
] as const;

export type ClassificationMode = (typeof classificationModes)[number];
