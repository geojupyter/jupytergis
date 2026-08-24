import type {
  IJGISLayer,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';

import { peekStorySegmentMarkdown } from '@/src/features/story/utils/storySegmentMarkdownSharedModel';

export interface IStorySegmentClipboardItem {
  name: string;
  parameters: IStorySegmentLayer;
}

let clipboard: IStorySegmentClipboardItem | null = null;

function cloneSegmentParameters(
  parameters: IStorySegmentLayer,
): IStorySegmentLayer {
  return structuredClone(parameters);
}

/**
 * Snapshot the selected story segment for in-session paste.
 * Prefers live Y.Text markdown when the editor has a fresher value than
 * layer parameters (debounced sync).
 */
export function copyStorySegment(
  model: IJupyterGISModel,
  segmentId: string,
): boolean {
  const layer = model.getLayer(segmentId) as IJGISLayer | undefined;
  if (!layer || layer.type !== 'StorySegmentLayer' || !layer.parameters) {
    return false;
  }

  const parameters = cloneSegmentParameters(
    layer.parameters as IStorySegmentLayer,
  );

  const liveMarkdown = peekStorySegmentMarkdown(model, segmentId);

  if (liveMarkdown !== undefined) {
    parameters.content = {
      ...parameters.content,
      contentMode: parameters.content?.contentMode ?? 'markdown',
      markdown: liveMarkdown,
    };
  }

  clipboard = {
    name: layer.name,
    parameters,
  };

  return true;
}

export function getStorySegmentClipboard(): IStorySegmentClipboardItem | null {
  return clipboard;
}

export function hasStorySegmentClipboard(): boolean {
  return clipboard !== null;
}

/** @internal Test helper */
export function clearStorySegmentClipboard(): void {
  clipboard = null;
}
