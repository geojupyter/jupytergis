import type {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { RefObject, useCallback, useEffect, useMemo, useState } from 'react';

import {
  getStoryPresentationMode,
  isColumnPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import type { IOverrideLayerEntry } from '@/src/features/story/types/types';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from '@/src/features/story/utils/storySegmentOverrides';

export interface IUseStoryMapParams {
  model: IJupyterGISModel;
  overrideLayerEntriesRef: RefObject<IOverrideLayerEntry[]>;
  removeLayer?: (id: string) => void;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  isSpecta: boolean;
}

export function useStoryMap({
  model,
  overrideLayerEntriesRef,
  removeLayer,
}: IUseStoryMapParams) {
  const [currentIndex, setCurrentIndex] = useState(
    () => model.getCurrentSegmentIndex() ?? 0,
  );
  const [storyData, setStoryData] = useState<IJGISStoryMap | null>(
    () => model.getSelectedStory().story ?? null,
  );

  const storySegments = useMemo(() => {
    if (!storyData?.storySegments) {
      return [];
    }
    return storyData.storySegments
      .map(segmentId => model.getLayer(segmentId))
      .filter((layer): layer is IJGISLayer => layer !== undefined);
  }, [storyData, model]);

  const segmentCount = storySegments.length;
  const storySegmentIds = storyData?.storySegments;

  const currentStorySegment = useMemo(
    () => storySegments[currentIndex],
    [storySegments, currentIndex],
  );

  const activeSlide = useMemo(
    () => currentStorySegment?.parameters,
    [currentStorySegment],
  );

  const layerName = useMemo(
    () => currentStorySegment?.name ?? '',
    [currentStorySegment],
  );

  const currentStorySegmentId = useMemo(
    () => storySegmentIds?.[currentIndex],
    [storySegmentIds, currentIndex],
  );
  const currentSegmentContentMode = activeSlide?.content?.contentMode;

  const showGradient = storyData?.showGradient ?? true;
  const isColumnStory = isColumnPresentation(
    getStoryPresentationMode(storyData?.storyType),
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < segmentCount - 1;

  const clearOverrideLayers = useCallback(() => {
    const entries = overrideLayerEntriesRef.current;
    if (!entries) {
      return;
    }
    clearSegmentLayerOverrideEntries(model, entries, removeLayer);
  }, [model, overrideLayerEntriesRef, removeLayer]);

  const setIndex = useCallback(
    (index: number) => {
      model.setCurrentSegmentIndex(index);
    },
    [model],
  );

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      model.setCurrentSegmentIndex(currentIndex - 1);
    }
  }, [model, currentIndex, hasPrev]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      model.setCurrentSegmentIndex(currentIndex + 1);
    }
  }, [model, currentIndex, hasNext]);

  const setSelectedLayerByIndex = useCallback(
    (index: number) => {
      const storySegmentId = storyData?.storySegments?.[index];
      if (storySegmentId) {
        model.selected = {
          [storySegmentId]: {
            type: 'layer',
          },
        };
      }
    },
    [storyData, model],
  );

  const overrideSymbology = useCallback(
    (index: number) => {
      const segmentId = storyData?.storySegments?.[index];
      if (index < 0 || !segmentId) {
        return;
      }

      applySegmentLayerOverrides(
        model,
        segmentId,
        overrideLayerEntriesRef.current ?? [],
      );
    },
    [model, storyData?.storySegments, overrideLayerEntriesRef],
  );

  useEffect(() => {
    const onIndexChanged = (_: IJupyterGISModel, index: number) => {
      setCurrentIndex(Math.max(0, index ?? 0));
    };
    model.currentSegmentIndexChanged.connect(onIndexChanged);
    return () => {
      model.currentSegmentIndexChanged.disconnect(onIndexChanged);
    };
  }, [model]);

  useEffect(() => {
    const updateStory = () => {
      clearOverrideLayers();
      setStoryData(model.getSelectedStory().story ?? null);
      setCurrentIndex(model.getCurrentSegmentIndex() ?? 0);
    };
    updateStory();
    model.sharedModel.storyMapsChanged.connect(updateStory);
    return () => {
      model.sharedModel.storyMapsChanged.disconnect(updateStory);
    };
  }, [model, clearOverrideLayers]);

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
  }, []);

  useEffect(() => {
    if (!currentStorySegmentId) {
      return;
    }
    if (currentSegmentContentMode === 'markdown') {
      return;
    }
    model.centerOnPosition(currentStorySegmentId);
  }, [model, currentStorySegmentId, currentSegmentContentMode]);

  // Set selected layer and apply symbology when segment changes; remove previous segment's override layers first.
  useEffect(() => {
    if (!storyData?.storySegments || currentIndex < 0) {
      return;
    }
    clearOverrideLayers();
    if (isColumnStory) {
      setSelectedLayerByIndex(currentIndex);
    }
    overrideSymbology(currentIndex);
  }, [
    storyData,
    currentIndex,
    isColumnStory,
    setSelectedLayerByIndex,
    clearOverrideLayers,
    overrideSymbology,
  ]);

  // Set selected layer on initial render and when story data changes
  useEffect(() => {
    if (isColumnStory && storyData?.storySegments && currentIndex >= 0) {
      setSelectedLayerByIndex(currentIndex);
    }
  }, [storyData, currentIndex, isColumnStory, setSelectedLayerByIndex]);

  return {
    storyData,
    storySegments,
    currentIndex,
    showGradient,
    clearOverrideLayers,
    setIndex,
    handlePrev,
    handleNext,
    hasPrev,
    hasNext,
    setSelectedLayerByIndex,
    currentStorySegment,
    activeSlide,
    layerName,
    currentStorySegmentId,
  };
}
