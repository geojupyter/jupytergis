import type { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React, { createContext, useContext } from 'react';

import { RenderedStoryMarkdown } from '@/src/features/story/components/RenderedStoryMarkdown';

const StoryRenderMimeContext = createContext<IRenderMimeRegistry | null>(null);

interface IStoryRenderMimeProviderProps {
  rendermime: IRenderMimeRegistry | null | undefined;
  children: React.ReactNode;
}

export function StoryRenderMimeProvider({
  rendermime,
  children,
}: IStoryRenderMimeProviderProps): JSX.Element {
  return (
    <StoryRenderMimeContext.Provider value={rendermime ?? null}>
      {children}
    </StoryRenderMimeContext.Provider>
  );
}

function useStoryRenderMime(): IRenderMimeRegistry | null {
  return useContext(StoryRenderMimeContext);
}

interface IListStoryOverlayMarkdownProps {
  source: string;
  onRendered?: () => void;
}

/** Markdown body for a list-story stage overlay segment. */
export function ListStoryOverlayMarkdown({
  source,
  onRendered,
}: IListStoryOverlayMarkdownProps): JSX.Element | null {
  const rendermime = useStoryRenderMime();

  return (
    <RenderedStoryMarkdown
      rendermime={rendermime}
      source={source}
      onRendered={onRendered}
    />
  );
}
