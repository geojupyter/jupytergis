import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useRef } from 'react';

import { MobileSpectaPanel } from './MobileSpectaPanel';
import StoryViewerPanel, { IStoryViewerPanelHandle } from './StoryViewerPanel';
import type { IOverrideLayerEntry } from './useStoryMap';
import { useStoryMap } from './useStoryMap';
import SpectaPresentationProgressBar from '../../statusbar/SpectaPresentationProgressBar';

export interface ISpectaPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile?: boolean;
  onSegmentTransitionEnd: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  storyViewerPanelRef: React.RefObject<IStoryViewerPanelHandle>;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
}

export function SpectaPanel({
  model,
  isSpecta,
  isMobile = false,
  onSegmentTransitionEnd,
  containerRef,
  storyViewerPanelRef,
  addLayer,
  removeLayer,
}: ISpectaPanelProps) {
  const overrideLayerEntriesRef = useRef<IOverrideLayerEntry[]>([]);
  const {
    storyData,
    currentIndex,
    clearOverrideLayers,
    setIndex,
    handlePrev,
    handleNext,
    hasPrev,
    hasNext,
    activeSlide,
    layerName,
  } = useStoryMap({
    model,
    overrideLayerEntriesRef,
    removeLayer,
    addLayer,
    panelRef: isMobile ? undefined : containerRef,
    isSpecta,
  });

  // On unmount: remove override layers and restore layer symbology
  useEffect(() => {
    return () => {
      clearOverrideLayers();
      storyData?.storySegments?.forEach(segmentId => {
        const segment = model.getLayer(segmentId);
        const overrides = segment?.parameters?.layerOverride;
        if (Array.isArray(overrides)) {
          overrides.forEach((override: { targetLayer?: string }) => {
            const targetLayerId = override.targetLayer;
            if (targetLayerId) {
              const targetLayer = model.getLayer(targetLayerId);
              targetLayer &&
                model.triggerLayerUpdate(targetLayerId, targetLayer);
            }
          });
        }
      });
    };
  }, [storyData, model, clearOverrideLayers]);

  if (isMobile) {
    return (
      <MobileSpectaPanel
        model={model}
        storyData={storyData}
        currentIndex={currentIndex}
        activeSlide={activeSlide}
        layerName={layerName}
        handlePrev={handlePrev}
        handleNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        setIndex={setIndex}
      />
    );
  }

  return (
    <>
      <div className="jgis-specta-right-panel-container-mod jgis-right-panel-container">
        <div ref={containerRef} className="jgis-specta-story-panel-container">
          <StoryViewerPanel
            ref={storyViewerPanelRef}
            model={model}
            isSpecta={isSpecta}
            className="jgis-story-viewer-panel-specta-mod"
            onSegmentTransitionEnd={onSegmentTransitionEnd}
            storyData={storyData}
            currentIndex={currentIndex}
            activeSlide={activeSlide}
            layerName={layerName}
            handlePrev={handlePrev}
            handleNext={handleNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            setIndex={setIndex}
          />
        </div>
      </div>
      <SpectaPresentationProgressBar model={model} />
    </>
  );
}
