import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BaseForm } from '@/src/formbuilder/objectform/baseform';
import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

interface IStoryPanelProps {
  model: IJupyterGISModel;
}

export function StoryEditorPanel({ model }: IStoryPanelProps) {
  const [schema, setSchema] = useState<IDict | undefined>(undefined);
  const [storyData, setStoryData] = useState<IJGISStoryMap | null>(null);

  // Get selected story info (derived from model)
  const { landmarkId, story } = useMemo(() => {
    return model.getSelectedStory();
  }, [model]);

  // Helper to update story data from selected story
  const updateStoryFromModel = useCallback(() => {
    setStoryData(story ?? null);
  }, [story]);

  // Load schema once on mount
  useEffect(() => {
    // Get the story map schema from the definitions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jgisSchema = require('@jupytergis/schema/lib/schema/project/jgis.json');
    const storyMapSchema = deepCopy(jgisSchema.definitions.jGISStoryMap);
    setSchema(storyMapSchema);
  }, []);

  // Load initial story data when selected story changes
  useEffect(() => {
    updateStoryFromModel();
  }, [updateStoryFromModel]);

  // Listen for story map changes
  useEffect(() => {
    if (!landmarkId) {
      return;
    }

    model.sharedModel.storyMapsChanged.connect(updateStoryFromModel);

    return () => {
      model.sharedModel.storyMapsChanged.disconnect(updateStoryFromModel);
    };
  }, [model, landmarkId, updateStoryFromModel]);

  const syncStoryData = (properties: IDict) => {
    if (!landmarkId) {
      return;
    }

    const { title, storyType, landmarks } = properties;
    const updatedStory: IJGISStoryMap = { title, storyType, landmarks };

    setStoryData(updatedStory);
    model.sharedModel.updateStoryMap(landmarkId, updatedStory);
  };

  if (!storyData) {
    return (
      <div style={{ padding: '10px' }}>
        <p>No story map available. Create one by adding a landmark.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px' }}>
      <h3>Story Map Properties</h3>
      <BaseForm
        formContext="update"
        sourceData={storyData}
        model={model}
        schema={schema}
        syncData={syncStoryData}
        filePath={model.filePath}
      />
    </div>
  );
}

export default StoryEditorPanel;
