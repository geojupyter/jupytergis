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
  IAttributeEditorActions,
  IAttributeEditorState,
} from '../types/editorTypes';

interface IAttributeFieldsProps {
  editorState: IAttributeEditorState;
  editorActions: IAttributeEditorActions;
}

export const AttributeFields: React.FC<IAttributeFieldsProps> = ({
  editorState,
  editorActions,
}) => {
  return (
    <>
      <Input
        className="jgis-property-col-key"
        type="text"
        placeholder="key"
        value={editorState.newAttributeKey}
        onChange={event =>
          editorActions.onNewAttributeKeyChange(event.target.value)
        }
      />
      <Input
        className="jgis-property-col-value"
        type="text"
        placeholder="value"
        value={editorState.newAttributeValue}
        onChange={event =>
          editorActions.onNewAttributeValueChange(event.target.value)
        }
      />
    </>
  );
};

interface IAttributeActionMenuProps {
  feature: IIdentifiedFeature;
  rowIndex: number;
  editorState: IAttributeEditorState;
  editorActions: IAttributeEditorActions;
}

interface IAttributeActionsMenuItem {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

interface IAttributeActionsMenuProps {
  title?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  onContentClick?: (event: React.MouseEvent) => void;
  items: IAttributeActionsMenuItem[];
}

export const AttributeActionsMenu: React.FC<IAttributeActionsMenuProps> = ({
  title = 'Attribute actions',
  side = 'left',
  onContentClick,
  items,
}) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="jgis-property-col-actions"
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

export const AttributeActionMenu: React.FC<IAttributeActionMenuProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  return (
    <AttributeActionsMenu
      items={[
        {
          label: 'Save',
          icon: <Save data-icon="inline-start" className="jgis-inline-icon" />,
          disabled:
            !editorState.newAttributeKey.trim() ||
            editorState.isSavingAttribute,
          onSelect: () => {
            editorActions.onSaveAttribute(feature, rowIndex);
          },
        },
        {
          label: 'Cancel',
          icon: <Ban data-icon="inline-start" className="jgis-inline-icon" />,
          variant: 'destructive',
          onSelect: () => {
            editorActions.onCancelAttribute();
          },
        },
      ]}
    />
  );
};

interface IAttributeRowEditorProps {
  feature: IIdentifiedFeature;
  rowIndex: number;
  editorState: IAttributeEditorState;
  editorActions: IAttributeEditorActions;
}

export const AttributeRowEditor: React.FC<IAttributeRowEditorProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  return (
    <div className="jgis-property-row jgis-property-row-editor">
      <AttributeFields
        editorState={editorState}
        editorActions={editorActions}
      />
      <AttributeActionMenu
        feature={feature}
        rowIndex={rowIndex}
        editorState={editorState}
        editorActions={editorActions}
      />
    </div>
  );
};

interface IAddAttributeEditorProps {
  feature: IIdentifiedFeature;
  rowIndex: number;
  editorState: IAttributeEditorState;
  editorActions: IAttributeEditorActions;
}

export const AddAttributeEditor: React.FC<IAddAttributeEditorProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  if (editorState.editorMode === 'add') {
    return (
      <AttributeRowEditor
        feature={feature}
        rowIndex={rowIndex}
        editorState={editorState}
        editorActions={editorActions}
      />
    );
  }

  return (
    <div className="jgis-property-row jgis-property-row-add">
      <Button
        className="jgis-property-add-button"
        onClick={() => editorActions.onStartAddProperty(rowIndex)}
        variant="outline"
        size="sm"
      >
        <CirclePlus data-icon="inline-start" className="jgis-inline-icon" />
        Add Attribute
      </Button>
    </div>
  );
};
