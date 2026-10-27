import type { IJGISStoryMap } from '@jupytergis/schema';
import type { CSSProperties } from 'react';

import {
  getStoryPresentationMode,
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

/** CSS variables for specta theming. */
export function getSpectaPresentationCssVars(
  story: IJGISStoryMap | null,
): CSSProperties {
  const presentationMode = getStoryPresentationMode(story?.storyType);
  const verticalScroll = isVerticalScrollPresentation(presentationMode);
  const overlayContentWidth = resolveCssWidth(story?.overlayContentWidth);
  const style: CSSProperties = {};

  if (story?.storyPanelOpacity !== undefined) {
    (style as Record<string, string>)['--jgis-story-panel-opacity'] = String(
      resolveStoryOpacity(story.storyPanelOpacity),
    );
  }

  if (verticalScroll) {
    (style as Record<string, string>)['--jgis-specta-panel-color'] =
      'transparent';

    if (overlayContentWidth) {
      (style as Record<string, string>)['--jgis-story-overlay-content-width'] =
        overlayContentWidth;
    }

    if (story?.markdownSegmentOpacity !== undefined) {
      (style as Record<string, string>)[
        '--jgis-story-markdown-segment-opacity'
      ] = String(resolveStoryOpacity(story.markdownSegmentOpacity));
    }
  }

  return style;
}
