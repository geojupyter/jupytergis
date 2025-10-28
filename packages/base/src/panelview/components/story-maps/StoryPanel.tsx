import { Button } from '@jupyter/react-components';
import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState, useCallback } from 'react';

import { BaseForm } from '@/src/formbuilder/objectform/baseform';
import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

interface IStoryPanelProps {
  model: IJupyterGISModel;
}

export function StoryEditorPanel({ model }: IStoryPanelProps) {
  const [schema, setSchema] = useState<IDict | undefined>(undefined);
  const [storyData, setStoryData] = useState<IDict>({});

  useEffect(() => {
    // Get the story map schema from the definitions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jgisSchema = require('@jupytergis/schema/lib/schema/project/jgis.json');
    const storyMapSchema = deepCopy(jgisSchema.definitions.jGISStoryMap);

    // Set initial data (you may need to get this from the model)
    const firstStory = Array.from(model.storiesMap.values())[0];
    const initialData: IDict = firstStory ?? {
      title: '',
      storyType: 'guided',
      landmarks: [] as string[],
    };

    setSchema(storyMapSchema);
    setStoryData(initialData);
  }, [model]);

  const syncStoryData = useCallback(
    (properties: IDict) => {
      // TODO: Implement sync to model
      // For now, just log the data
      console.log('Syncing story data:', properties);
      console.log('storyData', storyData);
      // You may want to store this in metadata or add methods to the model
      // model.sharedModel.setMetadata('storyMap', JSON.stringify(properties));
    },
    [storyData],
  );

  if (!schema) {
    return <div>Loading schema...</div>;
  }

  return (
    <div style={{ padding: '10px' }}>
      <h3>Story Map Properties</h3>
      <BaseForm
        formContext="create"
        sourceData={storyData}
        model={model}
        schema={schema}
        syncData={syncStoryData}
        filePath={model.filePath}
      />
      <Button onClick={syncStoryData}>Submit</Button>
    </div>
  );
}

export default StoryEditorPanel;
