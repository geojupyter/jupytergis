import { IDict, IIdentifiedFeature } from '@jupytergis/schema';

export type PatchGeoJSONFeatureAttributes = (
  sourceId: string,
  target: { featureId: string },
  attributeUpdates: IDict<any>,
) => Promise<boolean>;

export interface IAttributeEditorState {
  editingFeatureIndex: number | null;
  editorMode: 'add' | 'edit' | null;
  editingAttributeKey: string | null;
  newAttributeKey: string;
  newAttributeValue: string;
  isSavingAttribute: boolean;
}

export interface IAttributeEditorActions {
  onEditAttribute: (
    rowIndex: number,
    attributeKey: string,
    value: unknown,
  ) => void;
  onDeleteAttribute: (
    feature: IIdentifiedFeature,
    rowIndex: number,
    attributeKey: string,
  ) => Promise<void>;
  onStartAddAttribute: (rowIndex: number) => void;
  onSaveAttribute: (feature: IIdentifiedFeature, rowIndex: number) => void;
  onCancelAttribute: () => void;
  onNewAttributeKeyChange: (value: string) => void;
  onNewAttributeValueChange: (value: string) => void;
}
