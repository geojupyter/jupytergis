import type { IJGISStoryMap } from '@jupytergis/schema';
import type { CSSProperties } from 'react';

import {
  getStoryPresentationMode,
  isColumnPresentation,
  isVerticalScrollPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import { getCssVarAsColor } from '@/src/tools';

/** Jupyter theme vars used when presentation colors are unset (see storyPanel.css). */
const JP_THEME_BG_VAR = '--jp-layout-color0';
const JP_THEME_TEXT_VAR = '--jp-ui-font-color1';

export function resolveStoryPresentationColorForInput(
  color: string | undefined,
  kind: 'bg' | 'text',
): string {
  if (color) {
    return color;
  }

  return getCssVarAsColor(kind === 'bg' ? JP_THEME_BG_VAR : JP_THEME_TEXT_VAR);
}

/** CSS variables (+ optional text color) for specta theming */
export function getSpectaPresentationCssVars(
  story: IJGISStoryMap | null,
): CSSProperties {
  const presentationMode = getStoryPresentationMode(story?.storyType);
  const verticalScroll = isVerticalScrollPresentation(presentationMode);
  const bgColor = story?.presentationBgColor;
  const textColor = story?.presentationTextColor;
  const style: CSSProperties = {};

  if (textColor) {
    (style as Record<string, string>)['--jgis-specta-text-color'] = textColor;
    style.color = textColor;
  }

  if (verticalScroll) {
    (style as Record<string, string>)['--jgis-specta-panel-color'] =
      'transparent';
    if (bgColor) {
      (style as Record<string, string>)['--jgis-specta-bg-color'] = bgColor;
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
