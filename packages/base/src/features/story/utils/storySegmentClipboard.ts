import type {
  IJGISLayer,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';

import {
  getStorySegmentMarkdownSharedModel,
  peekStorySegmentMarkdown,
  disposeSegmentMarkdown,
} from '@/src/features/story/utils/storySegmentMarkdownSharedModel';

export interface IStorySegmentClipboardItem {
  name: string;
  parameters: IStorySegmentLayer;
}

let clipboard: IStorySegmentClipboardItem | null = null;

/**
 * Prefers live Y.Text markdown when the editor has a fresher value than
 * layer parameters
 */
export function copyStorySegment(
  model: IJupyterGISModel,
  segmentId: string,
): boolean {
  const layer = model.getLayer(segmentId);
  if (!layer || layer.type !== 'StorySegmentLayer' || !layer.parameters) {
    return false;
  }

  const parameters = structuredClone(layer.parameters as IStorySegmentLayer);

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

/**
 * Insert a clone of the clipboard segment after `insertAfterSegmentId`.
 * Returns the new segment id, or null if there is nothing to paste.
 */
export function pasteStorySegment(
  model: IJupyterGISModel,
  insertAfterSegmentId: string | null,
): string | null {
  if (!clipboard) {
    return null;
  }

  const { storyId, story } = model.getSelectedStory();
  if (!storyId || !story) {
    return null;
  }

  const newSegmentId = UUID.uuid4();
  const parameters = structuredClone(clipboard.parameters);
  const markdown = parameters.content?.markdown ?? '';

  const layerModel: IJGISLayer = {
    type: 'StorySegmentLayer',
    visible: true,
    name: `${clipboard.name} Copy`,
    parameters,
  };

  const segmentIds = [...(story.storySegments ?? [])];
  const selectedIndex = insertAfterSegmentId
    ? segmentIds.indexOf(insertAfterSegmentId)
    : -1;

  const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : segmentIds.length;
  segmentIds.splice(insertAt, 0, newSegmentId);

  // One undo step for layer + story list
  model.sharedModel.transact(() => {
    model.addLayer(newSegmentId, layerModel);
    model.sharedModel.updateStoryMap(storyId, {
      ...story,
      storySegments: segmentIds,
    });

    if (markdown) {
      getStorySegmentMarkdownSharedModel(model, newSegmentId, markdown);
    }
  });

  model.setCurrentSegmentIndex(insertAt);
  return newSegmentId;
}

/** Copy the segment into the clipboard and paste a clone after it. */
export function duplicateStorySegment(
  model: IJupyterGISModel,
  segmentId: string,
): string | null {
  if (!copyStorySegment(model, segmentId)) {
    return null;
  }

  return pasteStorySegment(model, segmentId);
}

/**
 * Dispose editor markdown state, then remove the segment on the model.
 * Returns false when the segment cannot be removed.
 */
export function removeStorySegment(
  model: IJupyterGISModel,
  segmentId: string,
): boolean {
  if (!model.canRemoveStorySegment()) {
    return false;
  }

  const segmentIds = model.getSelectedStory().story?.storySegments ?? [];
  if (!segmentIds.includes(segmentId)) {
    return false;
  }

  disposeSegmentMarkdown(model, segmentId);
  return model.removeStorySegment(segmentId);
}

export function clearStorySegmentClipboard(): void {
  clipboard = null;
}
