import React from 'react';

import { ColumnPresentationDesktop } from '@/src/features/story/presentation/modes/column/ColumnPresentationDesktop';
import { ColumnPresentationMobile } from '@/src/features/story/presentation/modes/column/ColumnPresentationMobile';
import { VerticalScrollPresentationMobile } from '@/src/features/story/presentation/modes/verticalScroll/VerticalScrollPresentationMobile';
import { isVerticalScrollPresentation } from '@/src/features/story/presentation/getStoryPresentationMode';
import type {
  IStoryPresentationDesktopChromeProps,
  IStoryPresentationMobileChromeProps,
} from '@/src/features/story/presentation/sharedChromeProps';

/** Desktop vertical-scroll scroll lives on the stage (`ListStoryStageScrollHost`). */
export function StoryPresentationDesktopChrome(
  props: IStoryPresentationDesktopChromeProps,
): JSX.Element {
  return <ColumnPresentationDesktop {...props} />;
}

export function StoryPresentationMobileChrome(
  props: IStoryPresentationMobileChromeProps,
): JSX.Element {
  if (isVerticalScrollPresentation(props.presentationMode)) {
    return <VerticalScrollPresentationMobile {...props} />;
  }

  return <ColumnPresentationMobile {...props} />;
}
