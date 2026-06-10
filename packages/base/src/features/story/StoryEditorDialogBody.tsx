import {
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';

import StoryEditorPanel from './StoryEditorPanel';
import { StoryEditorSegmentsPanel } from './StoryEditorSegmentsPanel';

export interface IStoryEditorDialogBodyProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

export function StoryEditorDialogBody({
  model,
  commands,
  state,
  formSchemaRegistry,
}: IStoryEditorDialogBodyProps): JSX.Element {
  return (
    <Tabs
      defaultValue="properties"
      className="jgis-panel-tabs jgis-story-editor-dialog-tabs"
    >
      <TabsList>
        <TabsTrigger className="jGIS-layer-browser-category" value="properties">
          Properties
        </TabsTrigger>
        <TabsTrigger className="jGIS-layer-browser-category" value="segments">
          Segments
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="properties"
        className="jgis-panel-tab-content jgis-story-editor-dialog-tab-content"
      >
        <StoryEditorPanel model={model} commands={commands} />
      </TabsContent>
      <TabsContent
        value="segments"
        className="jgis-panel-tab-content jgis-story-editor-dialog-tab-content"
      >
        <StoryEditorSegmentsPanel
          model={model}
          commands={commands}
          state={state}
          formSchemaRegistry={formSchemaRegistry}
        />
      </TabsContent>
    </Tabs>
  );
}
