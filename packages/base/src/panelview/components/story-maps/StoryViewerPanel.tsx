import {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
} from '@jupytergis/schema';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';

import StoryNavBar from './StoryNavBar';

interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
}

function StoryViewerPanel({ model }: IStoryViewerPanelProps) {
  const [currentIndexDisplayed, setCurrentIndexDisplayed] = useState(0);
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

  // Derive current landmark from landmarks and currentIndexDisplayed
  const currentLandmark = useMemo(() => {
    return landmarks[currentIndexDisplayed];
  }, [landmarks, currentIndexDisplayed]);

  // Derive active slide and layer name from current landmark
  const activeSlide = useMemo(() => {
    return currentLandmark?.parameters;
  }, [currentLandmark]);

  const layerName = useMemo(() => {
    return currentLandmark?.name ?? '';
  }, [currentLandmark]);

  // Derive landmark ID for zooming
  const currentLandmarkId = useMemo(() => {
    return storyData?.landmarks?.[currentIndexDisplayed];
  }, [storyData, currentIndexDisplayed]);

  const zoomToCurrentLayer = () => {
    if (currentLandmarkId) {
      model.centerOnPosition(currentLandmarkId);
    }
  };

  const setSelectedLayerByIndex = useCallback(
    (index: number) => {
      const landmarkId = storyData?.landmarks?.[index];
      if (landmarkId) {
        model.selected = {
          [landmarkId]: {
            type: 'layer',
          },
        };
      }
    },
    [storyData, model],
  );

  useEffect(() => {
    const updateStory = () => {
      const { story } = model.getSelectedStory();
      setStoryData(story ?? null);
      // Reset to first slide when story changes
      setCurrentIndexDisplayed(0);
    };

    updateStory();

    model.sharedModel.storyMapsChanged.connect(updateStory);

    return () => {
      model.sharedModel.storyMapsChanged.disconnect(updateStory);
    };
  }, [model]);

  // Auto-zoom when slide changes
  useEffect(() => {
    if (currentLandmarkId) {
      zoomToCurrentLayer();
    }
  }, [currentLandmarkId, model]);

  // Set selected layer on initial render and when story data changes
  useEffect(() => {
    if (storyData?.landmarks && currentIndexDisplayed >= 0) {
      setSelectedLayerByIndex(currentIndexDisplayed);
    }
  }, [storyData, currentIndexDisplayed, setSelectedLayerByIndex]);

  // Listen for layer selection changes in unguided mode
  useEffect(() => {
    // ! TODO this logic (getting a single selected layer) is also in the processing index.ts, move to tools
    const handleSelectedLandmarkChange = (thig: any, more: any, extra: any) => {
      // This is just to update the displayed content
      // So bail early if we don't need to do that
      if (!storyData || storyData.storyType !== 'unguided') {
        return;
      }

      const localState = model.sharedModel.awareness.getLocalState();
      if (!localState || !localState['selected']?.value) {
        return;
      }

      const selectedLayers = Object.keys(localState['selected'].value);

      // Ensure only one layer is selected
      if (selectedLayers.length !== 1) {
        return;
      }

      const selectedLayerId = selectedLayers[0];
      const selectedLayer = model.getLayer(selectedLayerId);
      if (!selectedLayer || selectedLayer.type !== 'LandmarkLayer') {
        return;
      }

      const index = storyData.landmarks?.indexOf(selectedLayerId);
      if (index === undefined || index === -1) {
        return;
      }

      setCurrentIndexDisplayed(index);
    };

    model.sharedModel.awareness.on('change', handleSelectedLandmarkChange);

    return () => {
      model.sharedModel.awareness.off('change', handleSelectedLandmarkChange);
    };
  }, [model, storyData]);

  const handlePrev = () => {
    if (currentIndexDisplayed > 0) {
      const newIndex = currentIndexDisplayed - 1;
      setCurrentIndexDisplayed(newIndex);
    }
  };

  const handleNext = () => {
    if (currentIndexDisplayed < landmarks.length - 1) {
      const newIndex = currentIndexDisplayed + 1;
      setCurrentIndexDisplayed(newIndex);
    }
  };

  if (!storyData) {
    return (
      <div>
        <p>No story map available. Create one in the Story Editor panel.</p>
      </div>
    );
  }

  return (
    <div className="jgis-story-viewer-panel">
      {/* Image container with title overlay */}
      {activeSlide?.content?.image ? (
        <div className="jgis-story-viewer-image-container">
          <img
            src={activeSlide.content.image}
            alt={activeSlide.content.title || 'Story map image'}
            className="jgis-story-viewer-image"
          />
          <h1 className="jgis-story-viewer-image-title">
            {`Slide ${currentIndexDisplayed + 1} - ${layerName ? layerName : 'Landmark Name'}`}
          </h1>
          {/* if guided -> nav buttons */}
          {storyData.storyType === 'guided' && (
            <div className="jgis-story-viewer-nav-container">
              <StoryNavBar
                onPrev={handlePrev}
                onNext={handleNext}
                hasPrev={currentIndexDisplayed > 0}
                hasNext={currentIndexDisplayed < landmarks.length - 1}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <h1 className="jgis-story-viewer-title">{storyData.title}</h1>
          {/* if guided -> nav buttons */}
          {storyData.storyType === 'guided' && (
            <StoryNavBar
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={currentIndexDisplayed > 0}
              hasNext={currentIndexDisplayed < landmarks.length - 1}
            />
          )}
        </>
      )}
      <h2 className="jgis-story-viewer-subtitle">
        {activeSlide?.content?.title
          ? activeSlide.content.title
          : 'Slide Title'}
      </h2>
      {activeSlide?.content?.markdown && (
        <div className="jgis-story-viewer-content">
          <Markdown>{activeSlide.content.markdown}</Markdown>
        </div>
      )}
    </div>
  );
}

export default StoryViewerPanel;
