import type { IJupyterGISModel } from '@jupytergis/schema';
import { AttachmentsModel, AttachmentsResolver } from '@jupyterlab/attachments';
import {
  RenderMimeRegistry,
  type IRenderMimeRegistry,
} from '@jupyterlab/rendermime';
import React, { createContext, useContext, useMemo } from 'react';

import { getSegmentAttachments } from '@/src/features/story/utils/storySegmentAttachments';

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

export function useStoryRenderMime(
  model: IJupyterGISModel,
  segmentId: string,
): IRenderMimeRegistry {
  const context = useContext(StoryRenderMimeContext);

  if (!context) {
    throw new Error(
      'useStoryRenderMime must be used within StoryRenderMimeProvider.',
    );
  }

  const attachmentsKey = JSON.stringify(
    getSegmentAttachments(model, segmentId),
  );

  return useMemo(() => {
    const attachmentsModel = new AttachmentsModel({
      values: getSegmentAttachments(model, segmentId),
    });

    return context.clone({
      resolver: new AttachmentsResolver({
        parent: context.resolver ?? undefined,
        model: attachmentsModel,
      }),
    });
  }, [context, model, segmentId, attachmentsKey]);
}
