import type { IJGISStoryMap } from '@jupytergis/schema';
import type { CSSProperties } from 'react';

import {
  getStoryPresentationMode,
  isColumnPresentation,
  isVerticalScrollPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import { getCssVarValue } from '@/src/tools';

/** Jupyter theme vars used when presentation colors are unset (see storyPanel.css). */
const JP_THEME_BG_VAR = '--jp-layout-color0';
const JP_THEME_TEXT_VAR = '--jp-ui-font-color1';

/** CSS fallback when overlay width is unset (see storyPanel.css). */
export const OVERLAY_CONTENT_WIDTH_FALLBACK = '100%';

export const OVERLAY_CONTENT_WIDTH_UNITS = [
  'ch',
  '%',
  'rem',
  'px',
  'em',
  'vw',
] as const;

export type OverlayContentWidthUnit =
  (typeof OVERLAY_CONTENT_WIDTH_UNITS)[number];

export const OVERLAY_CONTENT_WIDTH_PRESETS = [
  { id: 'narrow', label: 'Narrow', value: '50ch' },
  { id: 'comfort', label: 'Comfort', value: '75ch' },
  { id: 'wide', label: 'Wide', value: '100ch' },
  { id: 'full', label: 'Full', value: '100%' },
] as const;

export type OverlayContentWidthPresetId =
  (typeof OVERLAY_CONTENT_WIDTH_PRESETS)[number]['id'];

export function resolveStoryPresentationColorForInput(
  color: string | undefined,
  kind: 'bg' | 'text',
): string {
  if (color) {
    return color;
  }

  return getCssVarValue(kind === 'bg' ? JP_THEME_BG_VAR : JP_THEME_TEXT_VAR);
}

export function resolveOverlayContentWidthValue(
  width: string | undefined,
): string {
  const trimmed = width?.trim();

  return trimmed || OVERLAY_CONTENT_WIDTH_FALLBACK;
}

export function matchOverlayContentWidthPreset(
  width: string | undefined,
): OverlayContentWidthPresetId | null {
  const value = resolveOverlayContentWidthValue(width);
  const preset = OVERLAY_CONTENT_WIDTH_PRESETS.find(
    candidate => candidate.value === value,
  );

  return preset?.id ?? null;
}

export function parseOverlayContentWidth(width: string | undefined): {
  amount: string;
  unit: OverlayContentWidthUnit;
} {
  const value = resolveOverlayContentWidthValue(width);
  const match = /^(\d*\.?\d+)\s*(ch|%|rem|px|em|vw)$/i.exec(value);
  if (!match) {
    return { amount: '100', unit: '%' };
  }

  return {
    amount: match[1],
    unit: match[2].toLowerCase() as OverlayContentWidthUnit,
  };
}

export function formatOverlayContentWidth(
  amount: string,
  unit: OverlayContentWidthUnit,
): string {
  return `${amount.trim()}${unit}`;
}

/** CSS variables (+ optional text color) for specta theming */
export function getSpectaPresentationCssVars(
  story: IJGISStoryMap | null,
): CSSProperties {
  const presentationMode = getStoryPresentationMode(story?.storyType);
  const verticalScroll = isVerticalScrollPresentation(presentationMode);
  const bgColor = story?.presentationBgColor;
  const textColor = story?.presentationTextColor;
  const overlayContentWidth = story?.overlayContentWidth?.trim();
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
    if (overlayContentWidth) {
      (style as Record<string, string>)['--jgis-story-overlay-content-width'] =
        overlayContentWidth;
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
