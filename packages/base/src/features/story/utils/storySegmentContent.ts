import type { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';

import type {
  StorySegmentDisplayMode,
  StorySegmentPaneAlignment,
} from '@/src/features/story/types/types';

type SegmentContent = NonNullable<IStorySegmentLayer['content']>;

export type SegmentContentPatch = Partial<
  Pick<
    SegmentContent,
    'imageCaption' | 'markdown' | 'image' | 'attachments' | 'paneAlignment'
  >
>;

const EMPTY_SEGMENT_CONTENT: SegmentContent = { contentMode: 'map' };

/** Legacy default when paneAlignment is unset so we dont need to migrate
 * map -> end, markdown -> center. */
export function getSegmentPaneAlignment(
  content: SegmentContent | undefined,
  mode: StorySegmentDisplayMode,
): StorySegmentPaneAlignment {
  if (content?.paneAlignment) {
    return content.paneAlignment;
  }

  return mode === 'map' ? 'end' : 'center';
}

export function segmentPaneAlignment(
  alignment: StorySegmentPaneAlignment,
): 'flex-start' | 'center' | 'flex-end' {
  switch (alignment) {
    case 'start':
      return 'flex-start';
    case 'end':
      return 'flex-end';
    default:
      return 'center';
  }
}

export function normalizeSegmentContentForMode(
  content: SegmentContent | undefined,
  mode: StorySegmentDisplayMode,
): SegmentContent {
  const value: SegmentContent = content ?? EMPTY_SEGMENT_CONTENT;

  if (mode === 'markdown') {
    return {
      contentMode: 'markdown',
      markdown: value.markdown ?? '',
      attachments: value.attachments,
      paneAlignment: value.paneAlignment,
    };
  }

  return {
    contentMode: 'map',
    imageCaption: value.imageCaption ?? '',
    image: value.image ?? '',
    markdown: value.markdown ?? '',
    attachments: value.attachments,
    paneAlignment: value.paneAlignment,
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

export function updateSegmentLayerName(
  model: IJupyterGISModel,
  segmentId: string,
  name: string,
): boolean {
  const layer = model.getLayer(segmentId);

  if (!layer || layer.type !== 'StorySegmentLayer') {
    return false;
  }

  const nextName = name.trim();
  model.sharedModel.updateLayer(segmentId, { ...layer, name: nextName });

  return true;
}
