import type { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React, { createContext, useContext } from 'react';

const StoryRenderMimeContext = createContext<IRenderMimeRegistry | null>(null);

export interface IStoryRenderMimeProviderProps {
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

export function useStoryRenderMime(): IRenderMimeRegistry | null {
  return useContext(StoryRenderMimeContext);
}
