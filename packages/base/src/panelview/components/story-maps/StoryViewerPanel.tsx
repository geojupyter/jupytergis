import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
}

function StoryViewerPanel({ model }: IStoryViewerPanelProps) {
  const [storyData, setStoryData] = useState<IDict>({});
  console.log('storyData', storyData);
  //TODO this is copied from the editor panel, do better
  useEffect(() => {
    // Set initial data (you may need to get this from the model)
    const firstStory = Array.from(model.storiesMap.values())[0];
    const initialData: IDict = firstStory ?? {
      title: '',
      storyType: 'guided',
      landmarks: [] as string[],
    };

    setStoryData(initialData);
  }, [model]);
  return (
    <div>
      {/* title */}
      {/* content */}
      {/* if guided -> nav buttons */}
    </div>
  );
}

export default StoryViewerPanel;
