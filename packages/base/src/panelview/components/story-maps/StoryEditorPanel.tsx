import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import jgisSchema from '@jupytergis/schema/lib/schema/project/jgis.json';
import React, { useMemo } from 'react';

import { StoryEditorForm } from '@/src/formbuilder/objectform/StoryForm';
import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

interface IStoryPanelProps {
  model: IJupyterGISModel;
  togglePreview: () => void;
}

const storyMapSchema: IDict = deepCopy(jgisSchema.definitions.jGISStoryMap);

export function StoryEditorPanel({ model, togglePreview }: IStoryPanelProps) {
  const { landmarkId, story } = useMemo(() => {
    return model.getSelectedStory();
  }, [model, model.sharedModel.storiesMap]);

  const syncStoryData = (properties: IDict) => {
    const { title, storyType, landmarks } = properties;
    const updatedStory: IJGISStoryMap = { title, storyType, landmarks };

    model.sharedModel.updateStoryMap(landmarkId, updatedStory);
  };

  if (!story) {
    return (
      <div style={{ padding: '10px' }}>
        <p>No story map available. Create one by adding a landmark.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px' }}>
      <h3>Story Map Properties</h3>
      <StoryEditorForm
        formContext="update"
        sourceData={story}
        model={model}
        schema={storyMapSchema}
        syncData={syncStoryData}
        filePath={model.filePath}
        togglePreview={togglePreview}
      />
    </div>
  );
}

export default StoryEditorPanel;
