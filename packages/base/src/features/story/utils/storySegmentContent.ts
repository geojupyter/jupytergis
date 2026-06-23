import type { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';

import type { StorySegmentDisplayMode } from '@/src/features/story/types/types';

type SegmentContent = NonNullable<IStorySegmentLayer['content']>;

export type SegmentContentPatch = Partial<
  Pick<SegmentContent, 'title' | 'markdown' | 'image'>
>;

const EMPTY_SEGMENT_CONTENT: SegmentContent = { contentMode: 'map' };

export function normalizeSegmentContentForMode(
  content: SegmentContent | undefined,
  mode: StorySegmentDisplayMode,
): SegmentContent {
  const value: SegmentContent = content ?? EMPTY_SEGMENT_CONTENT;

  if (mode === 'markdown') {
    return {
      contentMode: 'markdown',
      markdown: value.markdown ?? '',
    };
  }

  return {
    contentMode: 'map',
    title: value.title ?? '',
    image: value.image ?? '',
    markdown: value.markdown ?? '',
  };
}

export function updateSegmentContentMode(
  model: IJupyterGISModel,
  segmentId: string,
  mode: StorySegmentDisplayMode,
): boolean {
  const layer = model.getLayer(segmentId);

  if (!layer || layer.type !== 'StorySegmentLayer') {
    return false;
  }

  const parameters = layer.parameters as IStorySegmentLayer;

  model.sharedModel.updateObjectParameters(segmentId, {
    content: normalizeSegmentContentForMode(parameters.content, mode),
  });

  return true;
}

export function updateSegmentContent(
  model: IJupyterGISModel,
  segmentId: string,
  patch: SegmentContentPatch,
): boolean {
  const layer = model.getLayer(segmentId);

  if (!layer || layer.type !== 'StorySegmentLayer') {
    return false;
  }

  const parameters = layer.parameters as IStorySegmentLayer;
  const current: SegmentContent = parameters.content ?? EMPTY_SEGMENT_CONTENT;

  model.sharedModel.updateObjectParameters(segmentId, {
    content: {
      ...current,
      ...patch,
    },
  });

  return true;
}
