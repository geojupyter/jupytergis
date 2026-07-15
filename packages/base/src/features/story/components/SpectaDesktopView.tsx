import React, { type JSX } from 'react';

import type { IStoryPresentationDesktopChromeProps } from '@/src/features/story/presentation/sharedChromeProps';
import { StoryPresentationDesktopChrome } from '@/src/features/story/presentation/StoryPresentationChrome';

export type ISpectaDesktopViewProps = IStoryPresentationDesktopChromeProps;

/** @deprecated Use StoryPresentationDesktopChrome from presentation/ */
export function SpectaDesktopView(
  props: ISpectaDesktopViewProps,
): JSX.Element {
  return <StoryPresentationDesktopChrome {...props} />;
}
