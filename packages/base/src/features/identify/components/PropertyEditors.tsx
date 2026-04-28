import { IIdentifiedFeature } from '@jupytergis/schema';
import { Ban, CirclePlus, Ellipsis, Save } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/shared/components/DropdownMenu';
import { Input } from '@/src/shared/components/Input';
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
  feature: IIdentifiedFeature;
  rowIndex: number;
  editorState: IPropertyEditorState;
  editorActions: IPropertyEditorActions;
}

interface IPropertyActionsMenuItem {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

interface IPropertyActionsMenuProps {
  title?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  onContentClick?: (event: React.MouseEvent) => void;
  items: IPropertyActionsMenuItem[];
}

export const PropertyActionsMenu: React.FC<IPropertyActionsMenuProps> = ({
  title = 'Property actions',
  side = 'left',
  onContentClick,
  items,
}) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="jgis-identify-col-actions"
          title={title}
          variant="icon"
          size="icon-md"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} onClick={onContentClick}>
        {items.map(item => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            variant={item.variant ?? 'default'}
            onSelect={item.onSelect}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const PropertyActionMenu: React.FC<IPropertyActionMenuProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  return (
    <PropertyActionsMenu
      items={[
        {
          label: 'Save',
          icon: <Save data-icon="inline-start" className="jgis-inline-icon" />,
          disabled:
            !editorState.newPropertyKey.trim() || editorState.isSavingProperty,
          onSelect: () => {
            editorActions.onSaveProperty(feature, rowIndex);
          },
        },
        {
          label: 'Cancel',
          icon: <Ban data-icon="inline-start" className="jgis-inline-icon" />,
          variant: 'destructive',
          onSelect: () => {
            editorActions.onCancelProperty();
          },
        },
      ]}
    />
  );
};

interface IPropertyRowEditorProps {
  feature: IIdentifiedFeature;
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
  feature: IIdentifiedFeature;
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
