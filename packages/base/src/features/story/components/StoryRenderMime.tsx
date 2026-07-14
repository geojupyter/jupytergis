import type { IJupyterGISModel } from '@jupytergis/schema';
import {
  RenderMimeRegistry,
  type IRenderMimeRegistry,
} from '@jupyterlab/rendermime';
import React, { createContext, useContext, useMemo } from 'react';

const StoryRenderMimeContext = createContext<IRenderMimeRegistry | null>(null);

function createStoryRenderMimeRegistry(
  rendermime: IRenderMimeRegistry,
  model: IJupyterGISModel,
): IRenderMimeRegistry {
  const { filePath, contentsManager } = model;

  if (!filePath || !contentsManager) {
    throw new Error(
      'Story markdown requires model.filePath and model.contentsManager.',
    );
  }

  const resolver = new RenderMimeRegistry.UrlResolver({
    path: filePath,
    contents: contentsManager,
  });

  return rendermime.clone({ resolver });
}

interface IStoryRenderMimeProviderProps {
  rendermime: IRenderMimeRegistry;
  model: IJupyterGISModel;
  children: React.ReactNode;
}

export function StoryRenderMimeProvider({
  rendermime,
  model,
  children,
}: IStoryRenderMimeProviderProps): JSX.Element {
  const scopedRendermime = useMemo(
    () => createStoryRenderMimeRegistry(rendermime, model),
    [rendermime, model, model.filePath, model.contentsManager],
  );

  return (
    <StoryRenderMimeContext.Provider value={scopedRendermime}>
      {children}
    </StoryRenderMimeContext.Provider>
  );
}

export function useStoryRenderMime(): IRenderMimeRegistry {
  const rendermime = useContext(StoryRenderMimeContext);

  if (!rendermime) {
    throw new Error(
      'useStoryRenderMime must be used within StoryRenderMimeProvider.',
    );
  }

  return rendermime;
}
