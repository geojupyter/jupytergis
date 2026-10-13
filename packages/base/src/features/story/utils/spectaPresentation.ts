import type { IJGISStoryMap } from '@jupytergis/schema';
import type { CSSProperties } from 'react';

import {
  getStoryPresentationMode,
  isColumnPresentation,
  isVerticalScrollPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import { resolveCssWidth } from './cssWidth';

/** Clamp story overlay opacity to the schema range [0, 1]. */
export function resolveStoryOpacity(opacity: number | undefined): number {
  if (opacity === undefined || !Number.isFinite(opacity)) {
    return 1;
  }

  return Math.min(1, Math.max(0, opacity));
}

/** CSS variables (+ optional text color) for specta theming */
export function getSpectaPresentationCssVars(
  story: IJGISStoryMap | null,
): CSSProperties {
  const presentationMode = getStoryPresentationMode(story?.storyType);
  const verticalScroll = isVerticalScrollPresentation(presentationMode);
  const bgColor = story?.presentationBgColor;
  const textColor = story?.presentationTextColor;
  const overlayContentWidth = resolveCssWidth(story?.overlayContentWidth);
  const style: CSSProperties = {};

  if (textColor) {
    (style as Record<string, string>)['--jgis-specta-text-color'] = textColor;
    style.color = textColor;
  }

  if (story?.storyPanelOpacity !== undefined) {
    (style as Record<string, string>)['--jgis-story-panel-opacity'] = String(
      resolveStoryOpacity(story.storyPanelOpacity),
    );
  }

  if (verticalScroll) {
    (style as Record<string, string>)['--jgis-specta-panel-color'] =
      'transparent';

    if (bgColor) {
      (style as Record<string, string>)['--jgis-specta-bg-color'] = bgColor;
    }

    if (overlayContentWidth) {
      (style as Record<string, string>)['--jgis-story-overlay-content-width'] =
        overlayContentWidth;
    }

    if (story?.markdownSegmentOpacity !== undefined) {
      (style as Record<string, string>)[
        '--jgis-story-markdown-segment-opacity'
      ] = String(resolveStoryOpacity(story.markdownSegmentOpacity));
    }

    return style;
  }

  if (bgColor) {
    (style as Record<string, string>)['--jgis-specta-panel-color'] = bgColor;
  }

  return style;
}

/**
 * Full inline style for solid surfaces (e.g. mobile drawer).
 * Do not use on `.jgis-specta-story-panel-container` — it overrides the gradient.
 */
export function getSpectaPresentationStyle(
  story: IJGISStoryMap | null,
): CSSProperties {
  const style = getSpectaPresentationCssVars(story);
  const column = isColumnPresentation(
    getStoryPresentationMode(story?.storyType),
  );
  const bgColor = story?.presentationBgColor;

  if (column && bgColor) {
    style.backgroundColor = bgColor;
  }

  return style;
}
