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
// const MAIN_ID = 'main';
const ABOVE_THE_FOLD_ID = 'above-the-fold';

const SNAP_FIRST_MIN = 0.15;
const SNAP_FIRST_MAX = 0.95;
const SNAP_FIRST_DEFAULT = 0.4;

interface IMobileSpectaPanelProps {
  model: IJupyterGISModel;
}

/**
 * Compute the first snap point so that vaul's transform offset (the amount
 * the drawer is pushed down) equals TARGET_OFFSET_PX. For a bottom drawer,
 * offset = mainHeight * (1 - snapPoint), so snapPoint = (mainHeight - offset) / mainHeight.
 */
const TARGET_OFFSET_PX = 153;

function getFirstSnapFromAboveTheFold(
  mainEl: HTMLElement,
  _aboveTheFoldEl: HTMLElement,
): number {
  const mainHeight = mainEl.getBoundingClientRect().height;
  if (mainHeight <= 0) {
    console.log(
      '[MobileSpectaPanel] main height <= 0, using default',
      SNAP_FIRST_DEFAULT,
    );
    return SNAP_FIRST_DEFAULT;
  }
  const fraction = (mainHeight - TARGET_OFFSET_PX) / mainHeight;
  const clamped = Math.max(SNAP_FIRST_MIN, Math.min(SNAP_FIRST_MAX, fraction));
  const resultingOffsetPx = mainHeight * (1 - clamped);
  console.log('[MobileSpectaPanel] getFirstSnapFromAboveTheFold', {
    mainHeight,
    targetOffsetPx: TARGET_OFFSET_PX,
    fraction: fraction.toFixed(3),
    clamped: clamped.toFixed(3),
    resultingOffsetPx: resultingOffsetPx.toFixed(1),
  });
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

  useEffect(() => {
    console.log('[MobileSpectaPanel] snapPoints', snapPoints);
  }, [snapPoints]);

  const [snap, setSnap] = useState<number | string | null>(snapPoints[0]);

  const presentationStyle = getSpectaPresentationStyle(model);

  useEffect(() => {
    console.log('snapPoints', snapPoints);
  }, [snapPoints]);

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
    setContainer(document.getElementById(MAIN_ID));
  }, []);

  useEffect(() => {
    const mainEl = document.getElementById(MAIN_ID);
    if (!mainEl) return;

    const updateFirstSnap = () => {
      const aboveTheFoldEl = document.getElementById(ABOVE_THE_FOLD_ID);
      if (aboveTheFoldEl) {
        const firstSnap = getFirstSnapFromAboveTheFold(mainEl, aboveTheFoldEl);
        setSnapPoints([0.3, firstSnap, 1]);
      } else {
        console.log(
          '[MobileSpectaPanel] updateFirstSnap: #above-the-fold not found',
        );
      }
    };

    console.log(
      '[MobileSpectaPanel] setting up observers, #main found',
      !!mainEl,
    );
    updateFirstSnap();

    const resizeObserver = new ResizeObserver(() => {
      console.log('[MobileSpectaPanel] ResizeObserver fired');
      updateFirstSnap();
    });
    resizeObserver.observe(mainEl);

    let aboveTheFoldObserved = false;
    const observeAboveTheFold = (el: HTMLElement | null) => {
      if (el && !aboveTheFoldObserved) {
        resizeObserver.observe(el);
        aboveTheFoldObserved = true;
        console.log('[MobileSpectaPanel] now observing #above-the-fold');
      }
    };

    const aboveTheFoldEl = document.getElementById(ABOVE_THE_FOLD_ID);
    observeAboveTheFold(aboveTheFoldEl);

    const mutationObserver = new MutationObserver(() => {
      observeAboveTheFold(document.getElementById(ABOVE_THE_FOLD_ID));
      updateFirstSnap();
    });
    mutationObserver.observe(document.body, {
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
