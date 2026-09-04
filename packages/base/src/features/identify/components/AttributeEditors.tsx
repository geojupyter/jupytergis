import { IIdentifiedFeature } from '@jupytergis/schema';
import { Ban, CirclePlus, Ellipsis, Save } from 'lucide-react';
import React from 'react';

import { ButtonTw } from '@/src/shared/components/ButtonTw';
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ButtonTw
            type="button"
            className="jgis-attribute-col-actions"
            title={title}
            variant="ghost"
            size="icon-sm"
          >
            <Ellipsis />
          </ButtonTw>
        }
      />
      <DropdownMenuContent side={side} onClick={onContentClick}>
        {items.map(item => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            variant={item.variant ?? 'default'}
            onClick={item.onSelect}
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
          icon: <Save />,
          disabled:
            !editorState.newAttributeKey.trim() ||
            editorState.isSavingAttribute,
          onSelect: () => {
            editorActions.onSaveAttribute(feature, rowIndex);
          },
        },
        {
          label: 'Cancel',
          icon: <Ban />,
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
    <div className="jgis-attribute-row jgis-attribute-row-editor">
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
    <div className="jgis-attribute-row jgis-attribute-row-add">
      <ButtonTw
        className="jgis-attribute-add-button"
        onClick={() => editorActions.onStartAddAttribute(rowIndex)}
        variant="outline"
        size="sm"
      >
        <CirclePlus data-icon="inline-start" />
        Add Attribute
      </ButtonTw>
    </div>
  );
};
