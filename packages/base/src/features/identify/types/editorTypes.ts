export interface IPropertyEditorState {
  editingFeatureIndex: number | null;
  editorMode: 'add' | 'edit' | null;
  editingPropertyKey: string | null;
  newPropertyKey: string;
  newPropertyValue: string;
  isSavingProperty: boolean;
}

export interface IPropertyEditorActions {
  onEditProperty: (rowIndex: number, propertyKey: string, value: any) => void;
  onDeleteProperty: (
    feature: any,
    rowIndex: number,
    propertyKey: string,
  ) => Promise<void>;
  onStartAddProperty: (rowIndex: number) => void;
  onSaveProperty: (feature: any, rowIndex: number) => void;
  onCancelProperty: () => void;
  onNewPropertyKeyChange: (value: string) => void;
  onNewPropertyValueChange: (value: string) => void;
}
