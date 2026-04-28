import { Button } from '@/src/shared/components/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/shared/components/DropdownMenu';
import { Input } from '@/src/shared/components/Input';
import { Ban, CirclePlus, Ellipsis, Save } from 'lucide-react';
import React from 'react';

import {
  IPropertyEditorActions,
  IPropertyEditorState,
} from '../types/editorTypes';

interface IPropertyFieldsProps {
  editorState: IPropertyEditorState;
  editorActions: IPropertyEditorActions;
}

export const PropertyFields: React.FC<IPropertyFieldsProps> = ({
  editorState,
  editorActions,
}) => {
  return (
    <>
      <Input
        className="jgis-identify-col-key"
        type="text"
        placeholder="key"
        value={editorState.newPropertyKey}
        onChange={event =>
          editorActions.onNewPropertyKeyChange(event.target.value)
        }
      />
      <Input
        className="jgis-identify-col-value"
        type="text"
        placeholder="value"
        value={editorState.newPropertyValue}
        onChange={event =>
          editorActions.onNewPropertyValueChange(event.target.value)
        }
      />
    </>
  );
};

interface IPropertyActionMenuProps {
  feature: any;
  rowIndex: number;
  editorState: IPropertyEditorState;
  editorActions: IPropertyEditorActions;
}

export const PropertyActionMenu: React.FC<IPropertyActionMenuProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="jgis-identify-col-actions"
          title="Property actions"
          variant="icon"
          size="icon-md"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left">
        <DropdownMenuItem
          disabled={
            !editorState.newPropertyKey.trim() || editorState.isSavingProperty
          }
          onSelect={() => {
            editorActions.onSaveProperty(feature, rowIndex);
          }}
        >
          <Save data-icon="inline-start" className="jgis-inline-icon" />
          Save
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            editorActions.onCancelProperty();
          }}
        >
          <Ban data-icon="inline-start" className="jgis-inline-icon" />
          Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface IPropertyRowEditorProps {
  feature: any;
  rowIndex: number;
  editorState: IPropertyEditorState;
  editorActions: IPropertyEditorActions;
}

export const PropertyRowEditor: React.FC<IPropertyRowEditorProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  return (
    <div className="jgis-identify-row jgis-identify-row-editor">
      <PropertyFields editorState={editorState} editorActions={editorActions} />
      <PropertyActionMenu
        feature={feature}
        rowIndex={rowIndex}
        editorState={editorState}
        editorActions={editorActions}
      />
    </div>
  );
};

interface IAddPropertyEditorProps {
  feature: any;
  rowIndex: number;
  editorState: IPropertyEditorState;
  editorActions: IPropertyEditorActions;
}

export const AddPropertyEditor: React.FC<IAddPropertyEditorProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  if (editorState.editorMode === 'add') {
    return (
      <PropertyRowEditor
        feature={feature}
        rowIndex={rowIndex}
        editorState={editorState}
        editorActions={editorActions}
      />
    );
  }

  return (
    <div className="jgis-identify-row jgis-identify-row-add">
      <Button
        className="jgis-identify-add-button"
        onClick={() => editorActions.onStartAddProperty(rowIndex)}
        variant="outline"
        size="sm"
      >
        <CirclePlus data-icon="inline-start" className="jgis-inline-icon" />
        Add Property
      </Button>
    </div>
  );
};
