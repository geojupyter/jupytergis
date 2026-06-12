import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useMemo } from 'react';

import { ListStoryTitleBarDesktop } from '@/src/features/story/components/ListStoryTitleBarDesktop';
import { ListStoryTitleBarMobile } from '@/src/features/story/components/ListStoryTitleBarMobile';
import { useListStoryScrollTrackContext } from '@/src/features/story/context/ListStoryScrollTrackContext';
import { useCurrentSegmentIndex } from '@/src/features/story/hooks/useCurrentSegmentIndex';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';

interface IListStoryTitleBarProps {
  model: IJupyterGISModel;
  isMobile: boolean;
}

export function ListStoryTitleBar({
  model,
  isMobile,
}: IListStoryTitleBarProps): JSX.Element {
  const currentIndex = useCurrentSegmentIndex(model);
  const { scrollToSegmentIndex } = useListStoryScrollTrackContext();

  const segmentItems = useMemo(
    () =>
      buildStorySegmentViewItems(model, model.getSelectedStory().story ?? null),
    [model],
  );

  const titleBarProps = {
    segmentItems,
    currentIndex,
    onSegmentClick: scrollToSegmentIndex,
  };

  if (isMobile) {
    return <ListStoryTitleBarMobile {...titleBarProps} />;
  }

  return <ListStoryTitleBarDesktop {...titleBarProps} />;
}
