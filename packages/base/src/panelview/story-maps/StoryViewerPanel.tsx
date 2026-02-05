import {
  IJGISLayer,
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { UUID } from '@lumino/coreutils';

import StoryNavBar from './StoryNavBar';
import { cn } from '@/src/shared/components/utils';
import StoryContentSection from './components/StoryContentSection';
import StoryImageSection from './components/StoryImageSection';
import StorySubtitleSection from './components/StorySubtitleSection';
import StoryTitleSection from './components/StoryTitleSection';

/** Entry for a layer affected by symbology override: remove (added clone) or restore (modified existing). */
interface IOverrideLayerEntry {
  layerId: string;
  action: 'remove' | 'restore';
}

interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile?: boolean;
  className?: string;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
}

export interface IStoryViewerPanelHandle {
  handlePrev: () => void;
  handleNext: () => void;
  canNavigate: boolean;
}

/**
 * Where the story nav bar should be rendered in the viewer layout.
 * - below-title: normal mode, guided, no image (under the title)
 * - over-image: normal mode, guided, with image (over the image)
 * - subtitle-specta: specta mode desktop (next to subtitle, fixed centered)
 * - subtitle-specta-mobile: specta mode mobile (in line with subtitle)
 */
export type StoryNavPlacement =
  | 'below-title'
  | 'over-image'
  | 'subtitle-specta'
  | 'subtitle-specta-mobile';

/**
 * Returns which section should render the nav bar, or null if nav should be hidden.
 */
function getStoryNavPlacement(
  isSpecta: boolean,
  hasImage: boolean,
  storyType: string,
  isMobile: boolean,
): StoryNavPlacement | null {
  if (isSpecta) {
    return isMobile ? 'subtitle-specta-mobile' : 'subtitle-specta';
  }
  if (storyType !== 'guided') {
    return null;
  }
  return hasImage ? 'over-image' : 'below-title';
}

const StoryViewerPanel = forwardRef<
  IStoryViewerPanelHandle,
  IStoryViewerPanelProps
>(
  (
    { model, isSpecta, isMobile = false, className, addLayer, removeLayer },
    ref,
  ) => {
    const [currentIndexDisplayed, setCurrentIndexDisplayed] = useState(() =>
      model.getCurrentSegmentIndex(),
    );
    const [storyData, setStoryData] = useState<IJGISStoryMap | null>(
      model.getSelectedStory().story ?? null,
    );
    const [imageLoaded, setImageLoaded] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const setIndex = useCallback(
      (index: number) => {
        model.setCurrentSegmentIndex(index);
        setCurrentIndexDisplayed(index);
      },
      [model],
    );

    /** Layers affected by symbology override
     * We want to remove added layers (ie Heatmap)
     * and Restore the original symbology for modified layers
     */
    const overrideLayerEntriesRef = useRef<IOverrideLayerEntry[]>([]);

    const clearOverrideLayers = useCallback(() => {
      overrideLayerEntriesRef.current.forEach(({ layerId, action }) => {
        if (action === 'remove') {
          removeLayer?.(layerId);
        } else {
          const layer = model.getLayer(layerId);
          if (layer) {
            model.triggerLayerUpdate(layerId, layer);
          }
        }
      });
      overrideLayerEntriesRef.current = [];
    }, [model]);

    // Derive story segments from story data
    const storySegments = useMemo(() => {
      if (!storyData?.storySegments) {
        return [];
      }

      return storyData.storySegments
        .map(storySegmentId => model.getLayer(storySegmentId))
        .filter((layer): layer is IJGISLayer => layer !== undefined);
    }, [storyData, model]);

    // Derive current story segment from story segments and currentIndexDisplayed
    const currentStorySegment = useMemo(() => {
      return storySegments[currentIndexDisplayed];
    }, [storySegments, currentIndexDisplayed]);

    // Derive active slide and layer name from current story segment
    const activeSlide = useMemo(() => {
      return currentStorySegment?.parameters;
    }, [currentStorySegment]);

    const layerName = useMemo(
      () => currentStorySegment?.name ?? '',
      [currentStorySegment],
    );

    // Derive story segment ID for zooming
    const currentStorySegmentId = useMemo(() => {
      return storyData?.storySegments?.[currentIndexDisplayed];
    }, [storyData, currentIndexDisplayed]);

    const hasPrev = currentIndexDisplayed > 0;
    const hasNext = currentIndexDisplayed < storySegments.length - 1;

    const zoomToCurrentLayer = () => {
      if (currentStorySegmentId) {
        model.centerOnPosition(currentStorySegmentId);
      }
    };

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

    // On unmount: remove override layers and restore layer symbology
    useEffect(() => {
      return () => {
        clearOverrideLayers();
        storyData?.storySegments?.forEach(segmentId => {
          const segment = model.getLayer(segmentId);
          const overrides = segment?.parameters?.symbologyOverride;
          if (Array.isArray(overrides)) {
            overrides.forEach((override: any) => {
              const targetLayerId = override.targetLayer;
              const targetLayer = model.getLayer(targetLayerId);
              targetLayer &&
                model.triggerLayerUpdate(targetLayerId, targetLayer);
            });
          }
        });
      };
    }, [storyData, model, clearOverrideLayers]);

    useEffect(() => {
      const updateStory = () => {
        clearOverrideLayers();
        const { story } = model.getSelectedStory();
        setStoryData(story ?? null);
        setIndex(model.getCurrentSegmentIndex() ?? 0);
      };

      updateStory();

      model.sharedModel.storyMapsChanged.connect(updateStory);

      return () => {
        model.sharedModel.storyMapsChanged.disconnect(updateStory);
      };
    }, [model, setIndex, clearOverrideLayers]);

    // Prefetch image when slide changes
    useEffect(() => {
      const imageUrl = activeSlide?.content?.image;

      if (!imageUrl) {
        setImageLoaded(false);
        return;
      }

      // Reset state
      setImageLoaded(false);

      // Preload the image
      const img = new Image();

      img.onload = () => {
        setImageLoaded(true);
      };

      img.onerror = () => {
        setImageLoaded(false);
      };

      img.src = imageUrl;

      // Cleanup: abort loading if component unmounts or slide changes
      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }, [activeSlide?.content?.image]);

    // Auto-zoom when slide changes
    useEffect(() => {
      if (currentStorySegmentId) {
        zoomToCurrentLayer();
      }
    }, [currentStorySegmentId, model]);

    // Set selected layer and apply symbology when segment changes; remove previous segment's override layers first.
    useEffect(() => {
      if (!storyData?.storySegments || currentIndexDisplayed < 0) {
        return;
      }
      clearOverrideLayers();
      setSelectedLayerByIndex(currentIndexDisplayed);
      overrideSymbology(currentIndexDisplayed);
    }, [
      storyData,
      currentIndexDisplayed,
      setSelectedLayerByIndex,
      clearOverrideLayers,
    ]);

    // Set selected layer on initial render and when story data changes
    useEffect(() => {
      if (storyData?.storySegments && currentIndexDisplayed >= 0) {
        setSelectedLayerByIndex(currentIndexDisplayed);
      }
    }, [storyData, currentIndexDisplayed, setSelectedLayerByIndex]);

    // Listen for layer selection changes in unguided mode
    useEffect(() => {
      // ! TODO this logic (getting a single selected layer) is also in the processing index.ts, move to tools
      const handleSelectedStorySegmentChange = () => {
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
        if (!selectedLayer || selectedLayer.type !== 'StorySegmentLayer') {
          return;
        }

        const index = storyData.storySegments?.indexOf(selectedLayerId);
        if (index === undefined || index === -1) {
          return;
        }

        setIndex(index);
      };

      // ! TODO really only want to connect this un unguided mode
      model.sharedModel.awareness.on(
        'change',
        handleSelectedStorySegmentChange,
      );

      return () => {
        model.sharedModel.awareness.off(
          'change',
          handleSelectedStorySegmentChange,
        );
      };
    }, [model, storyData, setIndex]);

    // Apply symbology overrides for the segment at the given index
    const overrideSymbology = (index: number) => {
      if (index < 0 || !storySegments[index]) {
        return;
      }

      const segment = storySegments[index];
      const symbologyOverrides: IStorySegmentLayer['symbologyOverride'] =
        segment.parameters?.symbologyOverride;

      if (!Array.isArray(symbologyOverrides)) {
        return;
      }

      // Apply all symbology overrides for this segment
      symbologyOverrides.forEach(override => {
        const {
          color,
          opacity,
          symbologyState,
          targetLayer: targetLayerId,
          visible,
        } = override;

        if (!targetLayerId) {
          return;
        }

        overrideLayerEntriesRef.current.push({
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
          // Heatmaps are actually a different layer, not just symbology
          // so they need special handling
          if (symbologyState?.renderType === 'Heatmap') {
            targetLayer.type = 'HeatmapLayer';
            if (addLayer) {
              const newId = UUID.uuid4();
              addLayer(newId, targetLayer, 100);
              overrideLayerEntriesRef.current.push({
                layerId: newId,
                action: 'remove',
              });
            }
          } else {
            model.triggerLayerUpdate(targetLayerId, targetLayer);
          }
        }
      });
    };

    const handlePrev = useCallback(() => {
      if (hasPrev) {
        setIndex(currentIndexDisplayed - 1);
      }
    }, [currentIndexDisplayed, setIndex]);

    const handleNext = useCallback(() => {
      if (hasNext) {
        setIndex(currentIndexDisplayed + 1);
      }
    }, [currentIndexDisplayed, storySegments.length, setIndex]);

    if (!storyData || storyData?.storySegments?.length === 0) {
      return (
        <div style={{ padding: '1rem' }}>
          <p>No Segments available. Add one using the Add Layer menu.</p>
        </div>
      );
    }

    const storyNavBarProps = {
      onPrev: handlePrev,
      onNext: handleNext,
      hasPrev,
      hasNext,
    };

    // Expose methods via ref for parent component to use
    useImperativeHandle(
      ref,
      () => ({
        handlePrev,
        handleNext,
        canNavigate: isSpecta,
      }),
      [handlePrev, handleNext, storyData, isSpecta],
    );

    const hasImage = !!(activeSlide?.content?.image && imageLoaded);
    const storyType = storyData.storyType ?? 'guided';
    const navPlacement = getStoryNavPlacement(
      isSpecta,
      hasImage,
      storyType,
      isMobile,
    );

    const navSlot =
      navPlacement !== null ? (
        <StoryNavBar placement={navPlacement} {...storyNavBarProps} />
      ) : null;

    // Get transition time from current segment, default to 0.3s
    const transitionTime = activeSlide?.transition?.time ?? 0.3;

    return (
      <div
        ref={panelRef}
        className={cn('jgis-story-viewer-panel', className)}
        id="jgis-story-segment-panel"
      >
        <div
          key={currentIndexDisplayed}
          className="jgis-story-segment-container"
          style={{
            animationDuration: `${transitionTime}s`,
          }}
        >
          <div id="jgis-story-segment-header">
            <h1 className="jgis-story-viewer-title">
              {layerName ?? `Slide ${currentIndexDisplayed + 1}`}
            </h1>
            {activeSlide?.content?.image && imageLoaded ? (
              <StoryImageSection
                imageUrl={activeSlide.content.image}
                imageLoaded={imageLoaded}
                layerName={layerName ?? ''}
                slideNumber={currentIndexDisplayed}
                navSlot={navPlacement === 'over-image' ? navSlot : null}
              />
            ) : (
              <StoryTitleSection
                title={storyData.title ?? ''}
                navSlot={navPlacement === 'below-title' ? navSlot : null}
              />
            )}
            <StorySubtitleSection
              title={activeSlide?.content?.title ?? ''}
              navSlot={
                navPlacement === 'subtitle-specta' ||
                navPlacement === 'subtitle-specta-mobile'
                  ? navSlot
                  : null
              }
            />
          </div>
          <div id="jgis-story-segment-content">
            <StoryContentSection
              markdown={activeSlide?.content?.markdown ?? ''}
            />
          </div>
        </div>
      </div>
    );
  },
);

StoryViewerPanel.displayName = 'StoryViewerPanel';

export default StoryViewerPanel;
