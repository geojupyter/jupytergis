import type { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import { useEffect } from 'react';

import { isTextEntryTarget } from '@/src/shared/editorAwareDialog';

export function shouldIgnoreStoryEditorArrowKeys(
  target: EventTarget | null,
): boolean {
  if (isTextEntryTarget(target)) {
    return true;
  }

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.closest('select, [role="combobox"], [role="listbox"]') !== null
  );
}

export function getAdjacentStorySegmentIndex(
  currentIndex: number,
  segmentCount: number,
  key: 'ArrowUp' | 'ArrowDown',
): number | null {
  const delta = key === 'ArrowDown' ? 1 : -1;
  const nextIndex = currentIndex + delta;

  if (nextIndex < 0 || nextIndex >= segmentCount) {
    return null;
  }

  return nextIndex;
}

export function useStoryEditorSegmentKeyboard(
  model: IJupyterGISModel,
  story: IJGISStoryMap | null,
): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (shouldIgnoreStoryEditorArrowKeys(event.target)) {
        return;
      }

      const segmentIds = story?.storySegments;
      if (!segmentIds?.length) {
        return;
      }

      const currentIndex = model.getCurrentSegmentIndex() ?? 0;
      const nextIndex = getAdjacentStorySegmentIndex(
        currentIndex,
        segmentIds.length,
        event.key,
      );

      if (nextIndex === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      model.setCurrentSegmentIndex(nextIndex);
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [model, story]);
}
