import {
  IDict,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  IJupyterGISWidget,
} from '@jupytergis/schema';
import { Dialog, WidgetTracker } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';
import { RJSFSchema } from '@rjsf/utils';
import { Map } from 'ol';

export { IDict };
export type ValueOf<T> = T[keyof T];

export type JupyterGISTracker = WidgetTracker<IJupyterGISWidget>;

export type SymbologyTab = 'color' | 'radius' | 'filters';

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

export const SYMBOLOGY_VALID_LAYER_TYPES = [
  'VectorLayer',
  'VectorTileLayer',
  'GeoTiffLayer',
  'HeatmapLayer',
];

export interface IWmsLayerInfo {
  name: string;
  title: string;
}

/** Form context passed to SchemaForm and custom fields. */
export interface IJupyterGISFormContext<TFormData = IDict | undefined> {
  model: IJupyterGISModel;
  formData: TFormData;
  wmsAvailableLayers?: IWmsLayerInfo[];
  setWmsAvailableLayers?: (layers: IWmsLayerInfo[]) => void;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
}

/** Optional form state (schema, extraErrors). */
export interface IBaseFormStates {
  schema?: RJSFSchema;
  extraErrors?: any;
}

/** Base props for object forms (layer, source, processing, story editor). */
export interface IBaseFormProps {
  formContext: 'update' | 'create';
  sourceData: IDict | undefined;
  filePath?: string;
  model: IJupyterGISModel;
  syncData: (properties: IDict) => void;
  schema?: IDict;
  ok?: Signal<Dialog<any>, number>;
  cancel?: () => void;
  formChangedSignal?: Signal<any, IDict<any>>;
  formErrorSignal?: Signal<Dialog<any>, boolean>;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
}
