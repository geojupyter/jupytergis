import type { IJupyterGISModel } from '@jupytergis/schema';
import React, { memo } from 'react';

import { RenderedStoryMarkdown } from '@/src/features/story/components/RenderedStoryMarkdown';

interface IListStoryOverlayMarkdownProps {
  model: IJupyterGISModel;
  segmentId: string;
  source: string;
  onRendered?: () => void;
}

function listStoryOverlayMarkdownPropsAreEqual(
  prev: IListStoryOverlayMarkdownProps,
  next: IListStoryOverlayMarkdownProps,
): boolean {
  return (
    prev.model === next.model &&
    prev.segmentId === next.segmentId &&
    prev.source === next.source
  );
}

/** Markdown body for a list-story stage overlay segment. */
export const ListStoryOverlayMarkdown = memo(function ListStoryOverlayMarkdown({
  model,
  segmentId,
  source,
  onRendered,
}: IListStoryOverlayMarkdownProps): JSX.Element | null {
  return (
    <RenderedStoryMarkdown
      model={model}
      segmentId={segmentId}
      source={source}
      onRendered={onRendered}
    />
  );
}, listStoryOverlayMarkdownPropsAreEqual);
