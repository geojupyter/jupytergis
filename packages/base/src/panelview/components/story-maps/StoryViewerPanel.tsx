import {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
  ILandmarkLayer,
} from '@jupytergis/schema';
import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';

import StoryNavBar from './StoryNavBar';

interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
}

function StoryViewerPanel({ model }: IStoryViewerPanelProps) {
  const [currentRankDisplayed, setCurrentRankDisplayed] = useState(0);
  const [storyData, setStoryData] = useState<IJGISStoryMap | null>(null);

  // Derive landmarks from story data
  const landmarks = useMemo(() => {
    if (!storyData?.landmarks) {
      return [];
    }
    return storyData.landmarks
      .map(landmarkId => model.getLayer(landmarkId))
      .filter((layer): layer is IJGISLayer => layer !== undefined);
  }, [storyData, model]);

  // Derive current landmark from landmarks and currentRankDisplayed
  const currentLandmark = useMemo(() => {
    return landmarks[currentRankDisplayed];
  }, [landmarks, currentRankDisplayed]);

  // Derive active slide and layer name from current landmark
  const activeSlide = useMemo(() => {
    return currentLandmark?.parameters as ILandmarkLayer | undefined;
  }, [currentLandmark]);

  const layerName = useMemo(() => {
    return currentLandmark?.name ?? '';
  }, [currentLandmark]);

  // Derive landmark ID for zooming
  const currentLandmarkId = useMemo(() => {
    return storyData?.landmarks?.[currentRankDisplayed];
  }, [storyData, currentRankDisplayed]);

  useEffect(() => {
    const updateStory = () => {
      const { story } = model.getSelectedStory();
      setStoryData(story ?? null);
      // Reset to first slide when story changes
      setCurrentRankDisplayed(0);
    };

    updateStory();

    model.sharedModel.storyMapsChanged.connect(updateStory);

    return () => {
      model.sharedModel.storyMapsChanged.disconnect(updateStory);
    };
  }, [model]);

  const zoomToCurrentLayer = () => {
    if (currentLandmarkId) {
      model.centerOnPosition(currentLandmarkId);
    }
  };

  const handlePrev = () => {
    if (currentRankDisplayed > 0) {
      setCurrentRankDisplayed(currentRankDisplayed - 1);
    }
  };

  const handleNext = () => {
    if (currentRankDisplayed < landmarks.length - 1) {
      setCurrentRankDisplayed(currentRankDisplayed + 1);
    }
  };

  // Auto-zoom when slide changes (only if guided mode)
  useEffect(() => {
    if (storyData?.storyType === 'guided' && currentLandmarkId) {
      zoomToCurrentLayer();
    }
  }, [currentRankDisplayed, storyData?.storyType, currentLandmarkId, model]);

  if (!storyData) {
    return (
      <div>
        <p>No story map available. Create one in the Story Editor panel.</p>
      </div>
    );
  }

  return (
    <div>
      {/* title */}
      <h1>{storyData.title}</h1>
      {/* content */}
      {activeSlide?.content?.imgSrc && <div>{activeSlide.content.imgSrc}</div>}
      <h2>
        {layerName && activeSlide?.content?.title
          ? `${layerName} - ${activeSlide.content.title}`
          : layerName || activeSlide?.content?.title || ''}
      </h2>
      {activeSlide?.content?.markdown && (
        <div>
          <Markdown>{activeSlide.content.markdown}</Markdown>
        </div>
      )}
      {/* if guided -> nav buttons */}
      {storyData.storyType === 'guided' && (
        <StoryNavBar
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={currentRankDisplayed > 0}
          hasNext={currentRankDisplayed < landmarks.length - 1}
        />
      )}
    </div>
  );
}

export default StoryViewerPanel;
