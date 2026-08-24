import type {
  IJGISLayer,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';

import {
  getStorySegmentMarkdownSharedModel,
  peekStorySegmentMarkdown,
} from '@/src/features/story/utils/storySegmentMarkdownSharedModel';

export interface IStorySegmentClipboardItem {
  name: string;
  parameters: IStorySegmentLayer;
}

let clipboard: IStorySegmentClipboardItem | null = null;

/** True when focus is in a text field / CodeMirror, keep normal clipboard/undo. */
export function isStoryEditorTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }

  return Boolean(
    target.closest('.cm-editor, .cm-content, [contenteditable="true"]'),
  );
}

/** Ctrl/Cmd (+ optional Shift) + key, ignoring Alt. */
export function isAccelKey(
  event: Pick<
    KeyboardEvent,
    'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
  >,
  key: string,
  options: { shift?: boolean } = {},
): boolean {
  const shift = options.shift ?? false;
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    event.shiftKey === shift &&
    event.key.toLowerCase() === key.toLowerCase()
  );
}

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
  const parameters = cloneSegmentParameters(clipboard.parameters);
  const markdown = parameters.content?.markdown ?? '';

  const layerModel: IJGISLayer = {
    type: 'StorySegmentLayer',
    visible: true,
    name: clipboard.name,
    parameters,
  };

  const segmentIds = [...(story.storySegments ?? [])];
  const selectedIndex = insertAfterSegmentId
    ? segmentIds.indexOf(insertAfterSegmentId)
    : -1;

  const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : segmentIds.length;
  segmentIds.splice(insertAt, 0, newSegmentId);

  // One undo step for layer + story list (+ markdown seed).
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
