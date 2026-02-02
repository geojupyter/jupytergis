import { IJupyterGISModel } from '@jupytergis/schema';
import React, { CSSProperties, useEffect, useState } from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
} from '@/src/shared/components/Drawer';
import StoryViewerPanel from './StoryViewerPanel';

const MAIN_ID = 'jp-main-content-panel';
const THE_FOLD_ID = 'the-fold';
const ABOVE_THE_FOLD_ID = 'above-the-fold';

const SNAP_FIRST_MIN = 0.15;
const SNAP_FIRST_MAX = 0.95;
const SNAP_FIRST_DEFAULT = 0.4;
/** Offset (px) for above-the-fold height: margins from p and h1 in story content */
const ABOVE_THE_FOLD_OFFSET_PX = 16.8 * 2 + 18.76;

interface IMobileSpectaPanelProps {
  model: IJupyterGISModel;
}

/**
 * Compute the first snap point so that vaul's --snap-point-height (the
 * transform offset) equals #the-fold height minus #above-the-fold height.
 * For a bottom drawer, offset = mainHeight * (1 - snapPoint), so
 * snapPoint = (mainHeight - offset) / mainHeight.
 */
function getFirstSnapFromAboveTheFold(
  mainEl: HTMLElement,
  theFoldEl: HTMLElement,
  aboveTheFoldEl: HTMLElement,
): number {
  const mainHeight = mainEl.getBoundingClientRect().height;
  const theFoldHeight = theFoldEl.getBoundingClientRect().height;
  const aboveTheFoldHeight = aboveTheFoldEl.getBoundingClientRect().height;
  const offsetPx =
    theFoldHeight - aboveTheFoldHeight - ABOVE_THE_FOLD_OFFSET_PX;

  if (mainHeight <= 0) {
    return SNAP_FIRST_DEFAULT;
  }

  const fraction = (mainHeight - offsetPx) / mainHeight;
  const clamped = Math.max(SNAP_FIRST_MIN, Math.min(SNAP_FIRST_MAX, fraction));
  return clamped;
}

function getSpectaPresentationStyle(model: IJupyterGISModel): CSSProperties {
  const story = model.getSelectedStory().story;
  const bgColor = story?.presentationBgColor;
  const textColor = story?.presentaionTextColor;

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

  // Vaul uses activeSnapPointIndex = snapPoints.indexOf(activeSnapPoint) and
  // sets --snap-point-height from snapPointsOffset[activeSnapPointIndex]. If
  // activeSnapPoint is not in snapPoints (e.g. after firstSnapPoint updates),
  // index is -1 and the CSS var becomes undefined. Keep snap in sync so it
  // always matches a value in snapPoints.
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

  useEffect(() => {
    const mainEl = document.getElementById(MAIN_ID) as HTMLElement | null;
    if (!mainEl) return;
    setContainer(mainEl);

    const updateFirstSnap = () => {
      const theFoldEl = document.getElementById(THE_FOLD_ID);
      const aboveTheFoldEl = document.getElementById(ABOVE_THE_FOLD_ID);
      if (theFoldEl && aboveTheFoldEl) {
        const firstSnap = getFirstSnapFromAboveTheFold(
          mainEl,
          theFoldEl as HTMLElement,
          aboveTheFoldEl as HTMLElement,
        );
        setSnapPoints([firstSnap, 1]);
      }
    };

    // #the-fold contains #above-the-fold, so observing it alone catches content resizes.
    const resizeObserver = new ResizeObserver(() => {
      updateFirstSnap();
    });

    /** Currently observed #the-fold element; re-attach when DOM identity changes (e.g. drawer reopen). */
    let observedFoldEl: HTMLElement | null = null;

    const syncFoldObserver = () => {
      const theFoldEl = document.getElementById(THE_FOLD_ID);
      const aboveTheFoldEl = document.getElementById(ABOVE_THE_FOLD_ID);
      if (!theFoldEl || !aboveTheFoldEl) return;

      const foldEl = theFoldEl as HTMLElement;
      if (foldEl === observedFoldEl) return;

      if (observedFoldEl) {
        resizeObserver.unobserve(observedFoldEl);
      }
      resizeObserver.observe(foldEl);
      // unobserve mutation here?
      observedFoldEl = foldEl;
      updateFirstSnap();
    };

    syncFoldObserver();

    const mutationObserver = new MutationObserver(() => {
      syncFoldObserver();
    });

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
