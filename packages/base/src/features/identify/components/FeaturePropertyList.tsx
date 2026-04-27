import React from 'react';

import {
  IPropertyEditorActions,
  IPropertyEditorState,
} from '../types/editorTypes';
import { FeatureRow } from './FeatureRow';
import { PropertyRowEditor } from './PropertyEditors';

interface IFeaturePropertyListProps {
  feature: any;
  rowIndex: number;
  editorState: IPropertyEditorState;
  editorActions: IPropertyEditorActions;
}

export const FeaturePropertyList: React.FC<IFeaturePropertyListProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  const isFeatureEditable = feature?._fromDrawTool === true;

  return (
    <>
      {Object.entries(feature)
        .filter(([_, value]) => typeof value !== 'object' || value === null)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => {
          const isEditingThisRow =
            editorState.editingFeatureIndex === rowIndex &&
            editorState.editorMode === 'edit' &&
            editorState.editingPropertyKey === key;

          if (isEditingThisRow) {
            return (
              <PropertyRowEditor
                key={key}
                feature={feature}
                rowIndex={rowIndex}
                editorState={editorState}
                editorActions={editorActions}
              />
            );
          }

          return (
            <FeatureRow
              key={key}
              propertyKey={key}
              value={value}
              showEditButton={isFeatureEditable && !key.startsWith('_')}
              onEditProperty={(propertyKey, propertyValue) =>
                editorActions.onEditProperty(
                  rowIndex,
                  propertyKey,
                  propertyValue,
                )
              }
            />
          );
        })}
    </>
  );
};
