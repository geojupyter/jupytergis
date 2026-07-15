import React from 'react';

import { isVerticalScrollPresentation } from '@/src/features/story/presentation/getStoryPresentationMode';
import { ColumnPresentationDesktop } from '@/src/features/story/presentation/modes/column/ColumnPresentationDesktop';
import { ColumnPresentationMobile } from '@/src/features/story/presentation/modes/column/ColumnPresentationMobile';
import { VerticalScrollPresentationMobile } from '@/src/features/story/presentation/modes/verticalScroll/VerticalScrollPresentationMobile';
import type {
  IStoryPresentationDesktopChromeProps,
  IStoryPresentationMobileChromeProps,
} from '@/src/features/story/presentation/sharedChromeProps';

export function StoryPresentationDesktopChrome(
  props: IStoryPresentationDesktopChromeProps,
): JSX.Element | null {
  if (isVerticalScrollPresentation(props.presentationMode)) {
    return null;
  }

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
