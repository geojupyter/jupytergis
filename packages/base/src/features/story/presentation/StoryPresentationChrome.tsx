import React from 'react';

import { ColumnPresentationDesktop } from '@/src/features/story/presentation/modes/column/ColumnPresentationDesktop';
import { ColumnPresentationMobile } from '@/src/features/story/presentation/modes/column/ColumnPresentationMobile';
import type {
  IStoryPresentationDesktopChromeProps,
  IStoryPresentationMobileChromeProps,
} from '@/src/features/story/presentation/sharedChromeProps';

/** Vertical-scroll scroll lives on the stage (`ListStoryStageScrollHost`). */
export function StoryPresentationDesktopChrome(
  props: IStoryPresentationDesktopChromeProps,
): JSX.Element {
  return <ColumnPresentationDesktop {...props} />;
}

export function StoryPresentationMobileChrome(
  props: IStoryPresentationMobileChromeProps,
): JSX.Element {
  return <ColumnPresentationMobile {...props} />;
}
