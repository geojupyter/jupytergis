import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/shared/components/Collapsible';
import React from 'react';

import {
  IPropertyEditorActions,
  IPropertyEditorState,
} from '../types/editorTypes';
import { FeatureCardHeader } from './FeatureCardHeader';
import { FeaturePropertyList } from './FeaturePropertyList';
import { AddPropertyEditor } from './PropertyEditors';

interface IFeatureCardProps {
  feature: any;
  rowIndex: number;
  featureTitle: string;
  isVisible: boolean;
  editorState: IPropertyEditorState;
  editorActions: IPropertyEditorActions;
  onToggleVisibility: (rowIndex: number, isOpen: boolean) => void;
  onToggleFloater: (rowIndex: number) => void;
  onHighlightFeature: (feature: any) => void;
}

export const FeatureCard: React.FC<IFeatureCardProps> = ({
  feature,
  rowIndex,
  featureTitle,
  isVisible,
  editorState,
  editorActions,
  onToggleVisibility,
  onToggleFloater,
  onHighlightFeature,
}) => {
  const cardEditorState: IPropertyEditorState =
    editorState.editingFeatureIndex === rowIndex
      ? editorState
      : {
          editingFeatureIndex: null,
          editorMode: null,
          editingPropertyKey: null,
          newPropertyKey: '',
          newPropertyValue: '',
          isSavingProperty: false,
        };

  return (
    <div className="identify-v2-card">
      <Collapsible
        open={isVisible}
        onOpenChange={nextOpen => onToggleVisibility(rowIndex, nextOpen)}
      >
        <CollapsibleTrigger asChild>
          <div className="jgis-symbology-override-collapsible-trigger">
            <FeatureCardHeader
              feature={feature}
              isOpen={isVisible}
              featureTitle={featureTitle}
              onToggleFloater={() => onToggleFloater(rowIndex)}
              onHighlightFeature={onHighlightFeature}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="identify-v2-content">
            <FeaturePropertyList
              feature={feature}
              rowIndex={rowIndex}
              editorState={cardEditorState}
              editorActions={editorActions}
            />
          </div>
          <AddPropertyEditor
            feature={feature}
            rowIndex={rowIndex}
            editorState={cardEditorState}
            editorActions={editorActions}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
