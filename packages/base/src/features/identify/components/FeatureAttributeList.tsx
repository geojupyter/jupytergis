import { IIdentifiedFeature } from '@jupytergis/schema';
import React from 'react';

import { AttributeRowEditor } from './AttributeEditors';
import { FeatureRow } from './FeatureRow';
import {
  IAttributeEditorActions,
  IAttributeEditorState,
} from '../types/editorTypes';

interface IFeatureAttributeListProps {
  feature: IIdentifiedFeature;
  rowIndex: number;
  editorState: IAttributeEditorState;
  editorActions: IAttributeEditorActions;
}

export const FeatureAttributeList: React.FC<IFeatureAttributeListProps> = ({
  feature,
  rowIndex,
  editorState,
  editorActions,
}) => {
  const isFeatureEditable = feature?._fromDrawTool === true;

  return (
    <div className="jgis-attribute-rows">
      {Object.entries(feature)
        .filter(([_, value]) => typeof value !== 'object' || value === null)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => {
          const isEditingThisRow =
            editorState.editingFeatureIndex === rowIndex &&
            editorState.editorMode === 'edit' &&
            editorState.editingAttributeKey === key;

          if (isEditingThisRow) {
            return (
              <AttributeRowEditor
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
              attributeKey={key}
              value={value}
              showActions={isFeatureEditable && !key.startsWith('_')}
              onEditAttribute={(attributeKey, attributeValue) =>
                editorActions.onEditAttribute(
                  rowIndex,
                  attributeKey,
                  attributeValue,
                )
              }
              onDeleteAttribute={(
                targetFeature,
                targetRowIndex,
                targetAttributeKey,
              ) =>
                editorActions.onDeleteAttribute(
                  targetFeature,
                  targetRowIndex,
                  targetAttributeKey,
                )
              }
            />
          );
        })}
    </div>
  );
};
