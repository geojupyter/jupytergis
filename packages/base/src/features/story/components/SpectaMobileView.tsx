import React, { type JSX } from 'react';

import type { IStoryPresentationMobileChromeProps } from '@/src/features/story/presentation/sharedChromeProps';
import { StoryPresentationMobileChrome } from '@/src/features/story/presentation/StoryPresentationChrome';

export type ISpectaMobileViewProps = IStoryPresentationMobileChromeProps;

/** @deprecated Use StoryPresentationMobileChrome from presentation/ */
export function SpectaMobileView(props: ISpectaMobileViewProps): JSX.Element {
  return <StoryPresentationMobileChrome {...props} />;
}
