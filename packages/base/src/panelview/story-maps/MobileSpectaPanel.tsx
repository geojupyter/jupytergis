import { IJupyterGISModel } from '@jupytergis/schema';
import React, { CSSProperties, useEffect, useState } from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '@/src/shared/components/Drawer';
import StoryViewerPanel from './StoryViewerPanel';

const MAIN_ID = 'jp-main-content-panel';
const SEGMENT_PANEL_ID = 'jgis-story-segment-panel';
const SEGMENT_HEADER_ID = 'jgis-story-segment-header';

const SNAP_FIRST_MIN = 0.3;
const SNAP_FIRST_MAX = 0.95;
const SNAP_FIRST_DEFAULT = 0.7;
/** Offset (px) for segment header height: margins from p and h1 in story content */
const SEGMENT_HEADER_OFFSET_PX = 16.8 * 2 + 18.76;

interface IMobileSpectaPanelProps {
  model: IJupyterGISModel;
}

/**
 * Compute the first snap point so that vaul's --snap-point-height (the
 * transform offset) equals #jgis-story-segment-panel height minus #jgis-story-segment-header height.
 * For a bottom drawer, offset = mainHeight * (1 - snapPoint), so
 * snapPoint = (mainHeight - offset) / mainHeight.
 */
function getFirstSnapFromSegmentHeader(
  mainEl: HTMLElement,
  segmentPanelEl: HTMLElement,
  segmentHeaderEl: HTMLElement,
): number {
  const mainHeight = mainEl.getBoundingClientRect().height;
  const segmentPanelHeight = segmentPanelEl.getBoundingClientRect().height;
  const segmentHeaderHeight = segmentHeaderEl.getBoundingClientRect().height;
  const offsetPx =
    segmentPanelHeight - segmentHeaderHeight - SEGMENT_HEADER_OFFSET_PX;

  if (mainHeight <= 0) {
    return SNAP_FIRST_DEFAULT;
  }

  const fraction = (mainHeight - offsetPx) / mainHeight;
  const clamped = Math.max(SNAP_FIRST_MIN, Math.min(SNAP_FIRST_MAX, fraction));
  return clamped;
}

/** Build inline styles for specta presentation (bg and text color from story). */
function getSpectaPresentationStyle(model: IJupyterGISModel): CSSProperties {
  const story = model.getSelectedStory().story;
  const bgColor = story?.presentationBgColor;
  const textColor = story?.presentationTextColor;

  const style: CSSProperties = {};
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

export function MobileSpectaPanel({ model }: IMobileSpectaPanelProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [snapPoints, setSnapPoints] = useState<number[]>([
    SNAP_FIRST_DEFAULT,
    1,
  ]);
  const [snap, setSnap] = useState<number | string | null>(snapPoints[0]);

  const presentationStyle = getSpectaPresentationStyle(model);

  // Keep active snap in sync with snapPoints so Vaul's --snap-point-height stays defined.
  useEffect(() => {
    const isInSnapPoints = snapPoints.some(
      p =>
        p === snap ||
        (typeof p === 'number' &&
          typeof snap === 'number' &&
          Math.abs(p - snap) < 1e-9),
    );
    if (!isInSnapPoints && snapPoints.length > 0) {
      setSnap(snapPoints[0]);
    }
  }, [snapPoints, snap]);

  // Observe #jgis-story-segment-panel (and re-attach when drawer reopens).
  useEffect(() => {
    const mainEl = document.getElementById(MAIN_ID);
    setContainer(mainEl);

    if (!mainEl) {
      return;
    }

    const updateFirstSnap = () => {
      const segmentPanelEl = document.getElementById(SEGMENT_PANEL_ID);
      const segmentHeaderEl = document.getElementById(SEGMENT_HEADER_ID);

      if (segmentPanelEl && segmentHeaderEl) {
        const firstSnap = getFirstSnapFromSegmentHeader(
          mainEl,
          segmentPanelEl,
          segmentHeaderEl,
        );
        setSnapPoints([firstSnap, 1]);
      }
    };

    const resizeObserver = new ResizeObserver(() => updateFirstSnap());
    let observedPanelEl: HTMLElement | null = null;

    const syncHeaderObserver = () => {
      const segmentPanelEl = document.getElementById(SEGMENT_PANEL_ID);
      const segmentHeaderEl = document.getElementById(SEGMENT_HEADER_ID);

      if (
        !segmentPanelEl ||
        !segmentHeaderEl ||
        segmentPanelEl === observedPanelEl
      ) {
        return;
      }

      if (observedPanelEl) {
        resizeObserver.unobserve(observedPanelEl);
      }
      resizeObserver.observe(segmentPanelEl);
      observedPanelEl = segmentPanelEl;
      updateFirstSnap();
    };

    syncHeaderObserver();

    const mutationObserver = new MutationObserver(syncHeaderObserver);
    mutationObserver.observe(mainEl, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return (
    <div className="jgis-mobile-specta-trigger-wrapper">
      <Drawer
        snapPoints={snapPoints}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        direction="bottom"
        container={container}
        noBodyStyles={true}
      >
        <DrawerTrigger asChild>
          <Button>Open Story Panel</Button>
        </DrawerTrigger>
        <DrawerContent style={presentationStyle}>
          <StoryViewerPanel isSpecta={true} isMobile={true} model={model} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
