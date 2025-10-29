import {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
  ILandmarkLayer,
} from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';

import StoryNavBar from './StoryNavBar';

interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
}

function StoryViewerPanel({ model }: IStoryViewerPanelProps) {
  const [storyData, setStoryData] = useState<IJGISStoryMap>({});
  const [currentRankDisplayed, setCurrentRankDisplayed] = useState(0);
  const [activeSlide, setActiveSlide] = useState<ILandmarkLayer | undefined>(
    undefined,
  );
  const [landmarks, setLandmarks] = useState<
    (IJGISLayer | undefined)[] | undefined
  >();

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

    setLandmarks(layers);
    setCurrentRankDisplayed(0);

    setStoryData(firstStory);
  }, []);

  const zoomToLayer = () => {
    const landmarkId = storyData.landmarks?.[currentRankDisplayed];
    if (landmarkId) {
      model?.centerOnPosition(landmarkId);
    }
  };

  return (
    <div>
      {/* title */}
      <span>{storyData.title}</span>
      {/* content */}
      <div>{activeSlide?.content?.imgSrc}</div>
      <div>{activeSlide?.content?.title}</div>
      {/* <div>{activeSlide?.content?.markdown}</div>
       */}
      <div>
        <Markdown>{activeSlide?.content?.markdown}</Markdown>
      </div>
      {/* if guided -> nav buttons */}
      {storyData.storyType === 'guided' && (
        <StoryNavBar
          onPrev={() => {
            const prevLandmark = landmarks?.[currentRankDisplayed - 1];
            if (prevLandmark?.parameters) {
              setActiveSlide(prevLandmark.parameters as ILandmarkLayer);
              setCurrentRankDisplayed(currentRankDisplayed - 1);
              zoomToLayer();
            }
          }}
          onNext={() => {
            const nextLandmark = landmarks?.[currentRankDisplayed + 1];
            if (nextLandmark?.parameters) {
              setActiveSlide(nextLandmark.parameters as ILandmarkLayer);
              setCurrentRankDisplayed(currentRankDisplayed + 1);
              zoomToLayer();
            }
          }}
          hasPrev={currentRankDisplayed > 0}
          hasNext={
            landmarks !== undefined &&
            currentRankDisplayed < landmarks.length - 1
          }
        />
      )}
    </div>
  );
}

export default StoryViewerPanel;
