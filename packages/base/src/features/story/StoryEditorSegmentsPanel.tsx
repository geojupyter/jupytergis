import {
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React, { useState } from 'react';

import { ObjectPropertiesReact } from '@/src/features/objectproperties';
import { LayersBodyComponent } from '@/src/workspace/panels/components/layers';
import { useLayerTree } from '@/src/workspace/panels/hooks/useLayerTree';

export interface IStoryEditorSegmentsPanelProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

export function StoryEditorSegmentsPanel({
  model,
  commands,
  state,
  formSchemaRegistry,
}: IStoryEditorSegmentsPanelProps): JSX.Element {
  const { segmentTree } = useLayerTree(model, commands);
  const [selectedObject, setSelectedObject] = useState<string | undefined>();

  return (
    <div className="jgis-story-editor-segments-panel">
      <div className="jgis-story-editor-segments-list jp-gis-layerPanel">
        <LayersBodyComponent
          model={model}
          commands={commands}
          state={state}
          layerTree={segmentTree}
        />
      </div>
      <div className="jgis-story-editor-segments-properties">
        <ObjectPropertiesReact
          model={model}
          formSchemaRegistry={formSchemaRegistry}
          selectedObject={selectedObject}
          setSelectedObject={setSelectedObject}
        />
      </div>
    </div>
  );
}
