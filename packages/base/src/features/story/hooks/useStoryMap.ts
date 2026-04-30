import type {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import {
  CSSProperties,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** Entry for a layer affected by layer override
 * remove if we added a layer or restore if we modified an existing layer.
 **/
export interface IOverrideLayerEntry {
  layerId: string;
  action: 'remove' | 'restore';
}

export interface IUseStoryMapParams {
  model: IJupyterGISModel;
  overrideLayerEntriesRef: RefObject<IOverrideLayerEntry[]>;
  removeLayer?: (id: string) => void;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  isSpecta: boolean;
  /** Panel root element for applying specta presentation CSS variables. */
  panelRef?: RefObject<HTMLDivElement | null>;
}

/** Inline style for specta presentation (bg and text color from story). */
export function getSpectaPresentationStyle(
  story: IJGISStoryMap | null,
): CSSProperties {
  const isListMode = story?.storyType === 'list';
  const bgColor = story?.presentationBgColor;
  const textColor = story?.presentationTextColor;
  const style: CSSProperties = {};
  if (isListMode) {
    (style as Record<string, string>)['--jgis-specta-bg-color'] = 'transparent';
    style.backgroundColor = 'transparent';
    return style;
  }

  if (bgColor) {
    (style as Record<string, string>)['--jgis-specta-bg-color'] = bgColor;
    style.backgroundColor = bgColor;
  }

  if (textColor) {
    (style as Record<string, string>)['--jgis-specta-text-color'] = textColor;
    style.color = textColor;
  }
  return style;
}

export function useStoryMap({
  model,
  overrideLayerEntriesRef,
  removeLayer,
  addLayer,
  panelRef,
  isSpecta,
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

  const showGradient = storyData?.showGradient ?? true;
  const isGuidedStory = storyData?.storyType === 'guided';
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < segmentCount - 1;

  const clearOverrideLayers = useCallback(() => {
    const entries = overrideLayerEntriesRef.current;
    if (!entries) {
      return;
    }
    entries.forEach(({ layerId, action }) => {
      if (action === 'remove') {
        removeLayer?.(layerId);
      } else {
        const layerOrSource = model.getLayerOrSource(layerId);
        if (layerOrSource) {
          model.triggerLayerUpdate(layerId, layerOrSource);
        }
      }
    });
    entries.length = 0;
  }, [model, overrideLayerEntriesRef, removeLayer]);

  const zoomToCurrentLayer = useCallback(() => {
    if (currentStorySegmentId) {
      model.centerOnPosition(currentStorySegmentId);
    }
  }, [model, currentStorySegmentId]);

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
      if (index < 0 || !storySegments[index]) {
        return;
      }

      const segment = storySegments[index];
      const layerOverrides: IStorySegmentLayer['layerOverride'] = (
        segment.parameters as IStorySegmentLayer['parameters']
      )?.layerOverride;

      if (!Array.isArray(layerOverrides)) {
        return;
      }

      layerOverrides.forEach(override => {
        const {
          color,
          opacity,
          sourceProperties,
          symbologyState,
          targetLayer: targetLayerId,
          visible,
        } = override;

        if (!targetLayerId) {
          return;
        }

        overrideLayerEntriesRef.current?.push({
          layerId: targetLayerId,
          action: 'restore',
        });

        const targetLayer = model.getLayer(targetLayerId);

        if (targetLayer?.parameters) {
          if (symbologyState !== undefined) {
            targetLayer.parameters.symbologyState = symbologyState;
          }
          if (color !== undefined) {
            targetLayer.parameters.color = color;
          }
          if (opacity !== undefined) {
            targetLayer.parameters.opacity = opacity;
          }
          if (visible !== undefined) {
            targetLayer.visible = visible;
          }
          if (
            sourceProperties !== undefined &&
            Object.keys(sourceProperties).length > 0
          ) {
            const sourceId = targetLayer.parameters?.source;
            if (sourceId) {
              const source = model.getSource(sourceId);
              if (!source) {
                return;
              }
              if (source?.parameters) {
                source.parameters = {
                  ...source.parameters,
                  ...sourceProperties,
                };
              }

              overrideLayerEntriesRef.current?.push({
                layerId: sourceId,
                action: 'restore',
              });

              model.triggerLayerUpdate(sourceId, source);
            }
          }
          if (symbologyState?.renderType === 'Heatmap') {
            targetLayer.type = 'HeatmapLayer';
            if (addLayer) {
              const newId = UUID.uuid4();
              addLayer(newId, targetLayer, 100);
              overrideLayerEntriesRef.current?.push({
                layerId: newId,
                action: 'remove',
              });
            }
          } else {
            model.triggerLayerUpdate(targetLayerId, targetLayer);
          }
        }
      });
    },
    [addLayer, model, storySegments, overrideLayerEntriesRef],
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
    if (currentStorySegmentId) {
      zoomToCurrentLayer();
    }
  }, [currentStorySegmentId, zoomToCurrentLayer]);

  // Set selected layer and apply symbology when segment changes; remove previous segment's override layers first.
  useEffect(() => {
    if (!storyData?.storySegments || currentIndex < 0) {
      return;
    }
    clearOverrideLayers();
    if (isGuidedStory) {
      setSelectedLayerByIndex(currentIndex);
    }
    overrideSymbology(currentIndex);
  }, [
    storyData,
    currentIndex,
    isGuidedStory,
    setSelectedLayerByIndex,
    clearOverrideLayers,
    overrideSymbology,
  ]);

  // Set selected layer on initial render and when story data changes
  useEffect(() => {
    if (isGuidedStory && storyData?.storySegments && currentIndex >= 0) {
      setSelectedLayerByIndex(currentIndex);
    }
  }, [storyData, currentIndex, isGuidedStory, setSelectedLayerByIndex]);

  // Apply story presentation colors (specta) to panel root
  useEffect(() => {
    if (!isSpecta || !panelRef?.current) {
      return;
    }
    const container = panelRef.current;
    const style = getSpectaPresentationStyle(storyData);
    Object.entries(style).forEach(([key, value]) => {
      if (value !== null) {
        container.style.setProperty(key, String(value));
      }
    });
  }, [storyData, isSpecta, panelRef]);

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
    zoomToCurrentLayer,
  };
}
