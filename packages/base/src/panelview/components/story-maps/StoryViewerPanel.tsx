import {
  IJGISStoryMap,
  IJupyterGISModel,
  ILandmarkLayer,
} from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
}

function StoryViewerPanel({ model }: IStoryViewerPanelProps) {
  const [storyData, setStoryData] = useState<IJGISStoryMap>({});
  const [activeSlide, setActiveSlide] = useState<ILandmarkLayer | undefined>(
    undefined,
  );

  //TODO this is copied from the editor panel, do better
  useEffect(() => {
    // Set initial data (you may need to get this from the model)
    // Set initial data (you may need to get this from the model)
    const entries = Object.entries(model.sharedModel.storiesMap);
    const [firstKey, firstStory] = entries[0] ?? [undefined, undefined];
    console.log('firstKey', firstKey);

    // need to build story
    // step 1: layerIds -> layers
    const layers = firstStory.landmarks?.map(landmarkId =>
      model.getLayer(landmarkId),
    );

    console.log('layers', layers);

    // sort the landmarks for a guided tour
    firstStory.storyType === 'guided' &&
      layers?.sort((a, b) => {
        if (!a || !b) {
          return 0;
        }
        const aParams = a.parameters as ILandmarkLayer;
        const bParams = b.parameters as ILandmarkLayer;
        const aRank = aParams?.rank ?? Number.MAX_SAFE_INTEGER;
        const bRank = bParams?.rank ?? Number.MAX_SAFE_INTEGER;
        return aRank - bRank;
      });

    console.log('sorted layers', layers);
    if (layers?.[0]) {
      setActiveSlide(layers[0].parameters as ILandmarkLayer);
    }

    setStoryData(firstStory);
  }, []);
  return (
    <div>
      {/* title */}
      <span>{storyData.title}</span>
      {/* content */}
      <div>{activeSlide?.content?.imgSrc}</div>
      <div>{activeSlide?.content?.title}</div>
      <div>{activeSlide?.content?.markdown}</div>
      {/* if guided -> nav buttons */}
    </div>
  );
}

export default StoryViewerPanel;
