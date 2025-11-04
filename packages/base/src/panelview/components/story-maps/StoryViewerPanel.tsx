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
  const [layerName, setLayerName] = useState('');
  const [activeSlide, setActiveSlide] = useState<ILandmarkLayer | undefined>(
    undefined,
  );
  const [landmarks, setLandmarks] = useState<
    (IJGISLayer | undefined)[] | undefined
  >();

  useEffect(() => {
    const updateStory = () => {
      const story = model.getSelectedStory();

      if (!story) {
        return;
      }

      // need to build story
      const layers = story.landmarks?.map(landmarkId =>
        model.getLayer(landmarkId),
      );

      if (layers?.[0]) {
        setActiveSlide(layers[0].parameters as ILandmarkLayer);
        setLayerName(layers[0].name);
      }

      setLandmarks(layers);
      setCurrentRankDisplayed(0);
      setStoryData(story);
    };

    updateStory();

    model.sharedModel.storyMapsChanged.connect(updateStory);

    return () => {
      model.sharedModel.storyMapsChanged.disconnect(updateStory);
    };
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
      <h1>{storyData.title}</h1>
      {/* content */}
      <div>{activeSlide?.content?.imgSrc}</div>
      <h2>{`${layerName} - ${activeSlide?.content?.title}`}</h2>
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
              setLayerName(prevLandmark.name);
              zoomToLayer();
            }
          }}
          onNext={() => {
            const nextLandmark = landmarks?.[currentRankDisplayed + 1];
            if (nextLandmark?.parameters) {
              setActiveSlide(nextLandmark.parameters as ILandmarkLayer);
              setCurrentRankDisplayed(currentRankDisplayed + 1);
              setLayerName(nextLandmark.name);
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
