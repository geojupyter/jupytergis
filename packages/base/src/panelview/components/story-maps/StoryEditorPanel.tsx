import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { BaseForm } from '@/src/formbuilder/objectform/baseform';
import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

interface IStoryPanelProps {
  model: IJupyterGISModel;
}

export function StoryEditorPanel({ model }: IStoryPanelProps) {
  const [schema, setSchema] = useState<IDict | undefined>(undefined);
  const [storyData, setStoryData] = useState<IJGISStoryMap>({});
  const [selectedStoryKey, setSelectedStoryKey] = useState('');

  useEffect(() => {
    if (!selectedStoryKey) {
      return;
    }

    const updateLandmarks = () => {
      const story = model.sharedModel.getStoryMap(selectedStoryKey);
      if (story) {
        setStoryData({ ...story });
      }
    };

    model.sharedModel.storyMapsChanged.connect(updateLandmarks);

    return () => {
      model.sharedModel.storyMapsChanged.disconnect(updateLandmarks);
    };
  }, [selectedStoryKey]);

  useEffect(() => {
    // Get the story map schema from the definitions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jgisSchema = require('@jupytergis/schema/lib/schema/project/jgis.json');
    const storyMapSchema = deepCopy(jgisSchema.definitions.jGISStoryMap);

    const { landmarkId, story } = model.getSelectedStory();

    setSchema(storyMapSchema);
    setSelectedStoryKey(landmarkId);
    if (story) {
      setStoryData(story);
    }
  }, []);

  const syncStoryData = (properties: IDict) => {
    if (!selectedStoryKey) {
      return;
    }

    const { title, storyType, landmarks } = properties;
    const updatedStory: IJGISStoryMap = { title, storyType, landmarks };

    setStoryData(updatedStory);
    model.sharedModel.updateStoryMap(selectedStoryKey, updatedStory);
  };

  if (!schema) {
    return <div>Loading schema...</div>;
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
