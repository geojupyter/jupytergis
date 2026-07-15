import React from 'react';

import { RenderedStoryMarkdown } from '@/src/features/story/components/RenderedStoryMarkdown';

interface IListStoryOverlayMarkdownProps {
  source: string;
  onRendered?: () => void;
}

/** Markdown body for a list-story stage overlay segment. */
export function ListStoryOverlayMarkdown({
  source,
  onRendered,
}: IListStoryOverlayMarkdownProps): JSX.Element | null {
  return <RenderedStoryMarkdown source={source} onRendered={onRendered} />;
}
