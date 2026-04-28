import { IDict, IIdentifiedFeature } from '@jupytergis/schema';

export type PatchGeoJSONFeatureProperties = (
  sourceId: string,
  target: { featureId: string },
  propertyUpdates: IDict<any>,
) => Promise<boolean>;

export interface IPropertyEditorState {
  editingFeatureIndex: number | null;
  editorMode: 'add' | 'edit' | null;
  editingPropertyKey: string | null;
  newPropertyKey: string;
  newPropertyValue: string;
  isSavingProperty: boolean;
}

export interface IPropertyEditorActions {
  onEditProperty: (
    rowIndex: number,
    propertyKey: string,
    value: unknown,
  ) => void;
  onDeleteProperty: (
    feature: IIdentifiedFeature,
    rowIndex: number,
    propertyKey: string,
  ) => Promise<void>;
  onStartAddProperty: (rowIndex: number) => void;
  onSaveProperty: (feature: IIdentifiedFeature, rowIndex: number) => void;
  onCancelProperty: () => void;
  onNewPropertyKeyChange: (value: string) => void;
  onNewPropertyValueChange: (value: string) => void;
}
