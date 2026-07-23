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
import { PropertyKeyValueFields } from '@/src/shared/components/PropertyKeyValueFields';
import {
  IAttributeEditorActions,
  IAttributeEditorState,
} from '../types/editorTypes';

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
      <PropertyKeyValueFields
        propertyKey={editorState.newAttributeKey}
        propertyValue={editorState.newAttributeValue}
        onPropertyKeyChange={editorActions.onNewAttributeKeyChange}
        onPropertyValueChange={editorActions.onNewAttributeValueChange}
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
        onClick={() => editorActions.onStartAddAttribute(rowIndex)}
        variant="outline"
        size="sm"
      >
        <CirclePlus data-icon="inline-start" className="jgis-inline-icon" />
        Add Attribute
      </Button>
    </div>
  );
};
