import type { IJGISStoryMap } from '@jupytergis/schema';
import type { CSSProperties } from 'react';

/** CSS variables (+ optional text color) for specta theming. Safe on gradient roots. */
export function getSpectaPresentationCssVars(
  story: IJGISStoryMap | null,
): CSSProperties {
  const isListMode = story?.storyType === 'list';
  const bgColor = story?.presentationBgColor;
  const textColor = story?.presentationTextColor;
  const style: CSSProperties = {};

  if (textColor) {
    (style as Record<string, string>)['--jgis-specta-text-color'] = textColor;
    style.color = textColor;
  }

  if (isListMode) {
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
  const isListMode = story?.storyType === 'list';
  const bgColor = story?.presentationBgColor;

  if (!isListMode && bgColor) {
    style.backgroundColor = bgColor;
  }

  return style;
}
