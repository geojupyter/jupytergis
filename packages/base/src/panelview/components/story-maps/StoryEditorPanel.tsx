import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import jgisSchema from '@jupytergis/schema/lib/schema/project/jgis.json';
import React, { useMemo } from 'react';

import { BaseForm } from '@/src/formbuilder';
import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

interface IStoryPanelProps {
  model: IJupyterGISModel;
}

const storyMapSchema: IDict = deepCopy(jgisSchema.definitions.jGISStoryMap);

export function StoryEditorPanel({ model }: IStoryPanelProps) {
  const { landmarkId, story } = useMemo(() => {
    return model.getSelectedStory();
  }, [model, model.sharedModel.storiesMap]);

  const syncStoryData = (properties: IDict) => {
    model.sharedModel.updateStoryMap(landmarkId, properties as IJGISStoryMap);
  };

  if (!story) {
    return (
      <div style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
        <p>No story map available. Create one by adding a landmark.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
      <BaseForm
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
