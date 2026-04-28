import { IIdentifiedFeature } from '@jupytergis/schema';
import React from 'react';

import { FeatureRow } from './FeatureRow';
import { PropertyRowEditor } from './PropertyEditors';
import {
  IPropertyEditorActions,
  IPropertyEditorState,
} from '../types/editorTypes';

interface IFeaturePropertyListProps {
  feature: IIdentifiedFeature;
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
    <div className="jgis-identify-property-rows">
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
              feature={feature}
              rowIndex={rowIndex}
              propertyKey={key}
              value={value}
              showActions={isFeatureEditable && !key.startsWith('_')}
              onEditProperty={(propertyKey, propertyValue) =>
                editorActions.onEditProperty(
                  rowIndex,
                  propertyKey,
                  propertyValue,
                )
              }
              onDeleteProperty={(
                targetFeature,
                targetRowIndex,
                targetPropertyKey,
              ) =>
                editorActions.onDeleteProperty(
                  targetFeature,
                  targetRowIndex,
                  targetPropertyKey,
                )
              }
            />
          );
        })}
    </div>
  );
};
