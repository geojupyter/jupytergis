import { IIdentifiedFeature } from '@jupytergis/schema';
import React from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/shared/components/Collapsible';
import { FeatureCardHeader } from './FeatureCardHeader';
import { FeatureAttributeList } from './FeatureAttributeList';
import { AddAttributeEditor } from './AttributeEditors';
import {
  IAttributeEditorActions,
  IAttributeEditorState,
} from '../types/editorTypes';

interface IFeatureCardProps {
  feature: IIdentifiedFeature;
  rowIndex: number;
  featureTitle: string;
  isVisible: boolean;
  isFloaterOpen: boolean;
  editorState: IAttributeEditorState;
  editorActions: IAttributeEditorActions;
  onToggleVisibility: (rowIndex: number, isOpen: boolean) => void;
  onToggleFloater: () => void;
  onHighlightFeature: (feature: any) => void;
}

export const FeatureCard: React.FC<IFeatureCardProps> = ({
  feature,
  rowIndex,
  featureTitle,
  isVisible,
  isFloaterOpen,
  editorState,
  editorActions,
  onToggleVisibility,
  onToggleFloater,
  onHighlightFeature,
}) => {
  const cardEditorState: IAttributeEditorState =
    editorState.editingFeatureIndex === rowIndex
      ? editorState
      : {
          editingFeatureIndex: null,
          editorMode: null,
          editingAttributeKey: null,
          newAttributeKey: '',
          newAttributeValue: '',
          isSavingAttribute: false,
        };

  return (
    <div className="jgis-identify-card">
      <Collapsible
        open={isVisible}
        onOpenChange={nextOpen => onToggleVisibility(rowIndex, nextOpen)}
      >
        <CollapsibleTrigger asChild>
          <div className="jgis-symbology-override-collapsible-trigger">
            <FeatureCardHeader
              feature={feature}
              isFloaterOpen={isFloaterOpen}
              featureTitle={featureTitle}
              onToggleFloater={onToggleFloater}
              onHighlightFeature={onHighlightFeature}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="jgis-identify-content">
            <FeatureAttributeList
              feature={feature}
              rowIndex={rowIndex}
              editorState={cardEditorState}
              editorActions={editorActions}
            />
            {feature._fromDrawTool === true && (
              <AddAttributeEditor
                feature={feature}
                rowIndex={rowIndex}
                editorState={cardEditorState}
                editorActions={editorActions}
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
