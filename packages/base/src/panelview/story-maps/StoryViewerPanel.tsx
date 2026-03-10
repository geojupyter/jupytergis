import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { cn } from '@/src/shared/components/utils';
import StoryNavBar from './StoryNavBar';
import StoryContentSection from './components/StoryContentSection';
import type { IOverrideLayerEntry } from './useStoryMap';
import { useOverrideSymbology, useStoryMap } from './useStoryMap';
import StoryImageSection from './components/StoryImageSection';
import StorySubtitleSection from './components/StorySubtitleSection';
import StoryTitleSection from './components/StoryTitleSection';

interface IStoryViewerPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  isMobile?: boolean;
  className?: string;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
  /** Called when the segment transition animation has finished (e.g. for scroll-guard cleanup). */
  onSegmentTransitionEnd?: () => void;
}

export interface IStoryViewerPanelHandle {
  handlePrev: () => void;
  handleNext: () => void;
  spectaMode: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  getAtTop: () => boolean;
  getAtBottom: () => boolean;
  /** The scrollable panel DOM element (same instance for all segments). */
  getScrollContainer: () => HTMLDivElement | null;
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
    {
      model,
      isSpecta,
      isMobile = false,
      className,
      addLayer,
      removeLayer,
      onSegmentTransitionEnd,
    },
    ref,
  ) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const segmentContainerRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const atTopRef = useRef(false);
    const atBottomRef = useRef(false);

    const overrideLayerEntriesRef = useRef<IOverrideLayerEntry[]>([]);

    const {
      storyData,
      storySegments,
      currentIndex,
      clearOverrideLayers,
      setIndex,
      handlePrev,
      handleNext,
      hasPrev,
      hasNext,
      activeSlide,
      layerName,
      currentStorySegmentId,
      zoomToCurrentLayer,
    } = useStoryMap({
      model,
      overrideLayerEntriesRef,
      removeLayer,
    });

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
          const overrides = segment?.parameters?.layerOverride;
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
      if (!storyData?.storySegments || currentIndex < 0) {
        return;
      }
      clearOverrideLayers();
      setSelectedLayerByIndex(currentIndex);
      overrideSymbology(currentIndex);
    }, [storyData, currentIndex, setSelectedLayerByIndex, clearOverrideLayers]);

    // Set selected layer on initial render and when story data changes
    useEffect(() => {
      if (storyData?.storySegments && currentIndex >= 0) {
        setSelectedLayerByIndex(currentIndex);
      }
    }, [storyData, currentIndex, setSelectedLayerByIndex]);

    // Apply story presentation colors (specta) to panel root
    useEffect(() => {
      if (!isSpecta || !panelRef.current) {
        return;
      }
      const container = panelRef.current;
      const bgColor = storyData?.presentationBgColor;
      const textColor = storyData?.presentationTextColor;
      if (bgColor) {
        container.style.setProperty('--jgis-specta-bg-color', bgColor);
      }
      if (textColor) {
        container.style.setProperty('--jgis-specta-text-color', textColor);
      }
    }, []);

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

    const overrideSymbology = useOverrideSymbology({
      model,
      storySegments,
      overrideLayerEntriesRef,
      addLayer,
    });

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

    // IntersectionObserver for at-top/at-bottom (avoids layout reads in scroll path)
    useEffect(() => {
      const root = panelRef.current;
      const topEl = topSentinelRef.current;
      const bottomEl = bottomSentinelRef.current;
      if (!root || !topEl || !bottomEl) {
        return;
      }
      const observer = new IntersectionObserver(
        (entries: IntersectionObserverEntry[]) => {
          for (const entry of entries) {
            if (entry.target === topEl) {
              atTopRef.current = entry.isIntersecting;
            } else if (entry.target === bottomEl) {
              atBottomRef.current = entry.isIntersecting;
            }
          }
        },
        { root, threshold: 0, rootMargin: '0px' },
      );
      observer.observe(topEl);
      observer.observe(bottomEl);
      return () => observer.disconnect();
    }, [currentIndex]);

    // Expose methods via ref for parent component to use
    useImperativeHandle(
      ref,
      () => ({
        handlePrev,
        handleNext,
        spectaMode: isSpecta,
        hasPrev,
        hasNext,
        getAtTop: () => atTopRef.current,
        getAtBottom: () => atBottomRef.current,
        getScrollContainer: () => panelRef.current,
      }),
      [handlePrev, handleNext, storyData, isSpecta, hasPrev, hasNext],
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

    // Notify parent when segment transition animation ends (e.g. for scroll-guard cleanup)
    useEffect(() => {
      const el = segmentContainerRef.current;
      if (!el || !onSegmentTransitionEnd) {
        return;
      }
      const handleAnimationEnd = (e: AnimationEvent) => {
        if (e.animationName === 'fadeIn') {
          el.removeEventListener('animationend', handleAnimationEnd);
          onSegmentTransitionEnd();
        }
      };
      el.addEventListener('animationend', handleAnimationEnd);
      return () => el.removeEventListener('animationend', handleAnimationEnd);
    }, [currentIndex, onSegmentTransitionEnd]);

    return (
      <div
        ref={panelRef}
        className={cn('jgis-story-viewer-panel', className)}
        id="jgis-story-segment-panel"
      >
        <div
          ref={topSentinelRef}
          aria-hidden
          data-story-scroll-sentinel="top"
          style={{ height: 1, minHeight: 1, pointerEvents: 'none' }}
        />
        <div
          ref={segmentContainerRef}
          key={currentIndex}
          className="jgis-story-segment-container"
          style={{
            animationDuration: `${transitionTime}s`,
          }}
        >
          <div id="jgis-story-segment-header">
            <h1 className="jgis-story-viewer-title">
              {layerName ?? `Slide ${currentIndex + 1}`}
            </h1>
            {activeSlide?.content?.image && imageLoaded ? (
              <StoryImageSection
                imageUrl={activeSlide.content.image}
                imageLoaded={imageLoaded}
                layerName={layerName ?? ''}
                slideNumber={currentIndex}
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
        <div
          ref={bottomSentinelRef}
          aria-hidden
          data-story-scroll-sentinel="bottom"
          style={{ height: 1, minHeight: 1, pointerEvents: 'none' }}
        />
      </div>
    );
  },
);

StoryViewerPanel.displayName = 'StoryViewerPanel';

export default StoryViewerPanel;
