import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { RenderedStoryMarkdown } from '@/src/features/story/components/RenderedStoryMarkdown';

interface IListStoryOverlayMarkdownProps {
  model: IJupyterGISModel;
  segmentId: string;
  source: string;
  onRendered?: () => void;
}

/** Markdown body for a list-story stage overlay segment. */
export function ListStoryOverlayMarkdown({
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
}
