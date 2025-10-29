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
  const [storyData, setStoryData] = useState<IDict>({});
  const [firstStoryKey, setFirstStoryKey] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    // Get the story map schema from the definitions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jgisSchema = require('@jupytergis/schema/lib/schema/project/jgis.json');
    const storyMapSchema = deepCopy(jgisSchema.definitions.jGISStoryMap);

    // Set initial data (you may need to get this from the model)
    const entries = Object.entries(model.sharedModel.storiesMap);
    const [firstKey, firstStory] = entries[0] ?? [undefined, undefined];

    const initialData: IJGISStoryMap = firstStory ?? {
      title: '',
      storyType: 'unguided',
      landmarks: [],
    };

    setSchema(storyMapSchema);
    setStoryData(initialData);
    setFirstStoryKey(firstKey);
  }, []);

  const syncStoryData = (properties: IDict) => {
    if (!firstStoryKey) {
      return;
    }

    const { title, storyType, landmarks } = properties;
    const updatedStory: IJGISStoryMap = { title, storyType, landmarks };

    setStoryData(updatedStory);
    model.sharedModel.updateStoryMap(firstStoryKey, updatedStory);
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
      {/* <Button onClick={syncStoryData}>Submit</Button> */}
    </div>
  );
}

export default StoryEditorPanel;
