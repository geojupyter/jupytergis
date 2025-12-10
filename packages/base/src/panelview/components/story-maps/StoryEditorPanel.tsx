import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import jgisSchema from '@jupytergis/schema/lib/schema/project/jgis.json';
import React, { useMemo } from 'react';

import { StoryEditorPropertiesForm } from '@/src/formbuilder/objectform/StoryEditorForm';
import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

interface IStoryPanelProps {
  model: IJupyterGISModel;
}

const storyMapSchema: IDict = deepCopy(jgisSchema.definitions.jGISStoryMap);

export function StoryEditorPanel({ model }: IStoryPanelProps) {
  const { landmarkId, story } = useMemo(() => {
    return model.getSelectedStory();
  }, [model, model.sharedModel.stories]);

  const syncStoryData = (properties: IDict) => {
    model.sharedModel.updateStoryMap(landmarkId, properties as IJGISStoryMap);
  };

  if (!story) {
    return (
      <div style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
        <p>No Story Map available.</p>
        <p>
          Add a Story Segment from the Add Layer menu. A segment captures the
          current map view. You can add markdown text and an image to each
          segment to tell your story.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
      <StoryEditorPropertiesForm
        formContext="update"
        sourceData={story}
        model={model}
        schema={storyMapSchema}
        syncData={syncStoryData}
        filePath={model.filePath}
      />
    </div>
  );
}

export default StoryEditorPanel;
