import type { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CommandIDs } from '@/src/constants';
import type {
  IStorySegmentViewItem,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/types';
import {
  type SegmentContentPatch,
  updateSegmentContent as applySegmentContent,
  updateSegmentContentMode as applySegmentContentMode,
} from '@/src/features/story/utils/storySegmentContent';
import {
  type SegmentTransitionPatch,
  updateSegmentTransition as applySegmentTransition,
} from '@/src/features/story/utils/storySegmentTransition';
import { buildStorySegmentViewItems } from '@/src/features/story/utils/storySegmentViewItems';

interface IUseStoryEditorSegmentListResult {
  storyId: string | null;
  story: IJGISStoryMap | null;
  segments: IStorySegmentViewItem[];
  selectedSegmentId: string | null;
  selectedSegment: IStorySegmentViewItem | null;
  selectSegment: (segmentId: string) => void;
  addSegment: () => void;
  removeSegment: () => void;
  canRemoveSegment: boolean;
  reorderSegments: (fromIndex: number, toIndex: number) => void;
  updateStory: (patch: Partial<IJGISStoryMap>) => void;
  updateSegmentContentMode: (
    segmentId: string,
    mode: StorySegmentDisplayMode,
  ) => void;
  updateSegmentContent: (segmentId: string, patch: SegmentContentPatch) => void;
  updateSegmentTransition: (
    segmentId: string,
    patch: SegmentTransitionPatch,
  ) => void;
}

export function useStoryEditorSegmentList(
  model: IJupyterGISModel,
  commands: CommandRegistry,
): IUseStoryEditorSegmentListResult {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const bump = (): void => {
      setRevision(value => value + 1);
    };

    model.sharedModel.layersChanged.connect(bump);
    model.sharedModel.storyMapsChanged.connect(bump);
    model.currentSegmentIndexChanged.connect(bump);
    model.segmentAdded.connect(bump);

    return () => {
      model.sharedModel.layersChanged.disconnect(bump);
      model.sharedModel.storyMapsChanged.disconnect(bump);
      model.currentSegmentIndexChanged.disconnect(bump);
      model.segmentAdded.disconnect(bump);
    };
  }, [model]);

  useEffect(() => {
    const handleSegmentAdded = (
      _sender: IJupyterGISModel,
      payload: { storySegmentId: string },
    ): void => {
      const { story: currentStory } = model.getSelectedStory();
      const index =
        currentStory?.storySegments?.indexOf(payload.storySegmentId) ?? -1;

      if (index >= 0) {
        model.setCurrentSegmentIndex(index);
      }
    };

    model.segmentAdded.connect(handleSegmentAdded);

    return () => {
      model.segmentAdded.disconnect(handleSegmentAdded);
    };
  }, [model]);

  const { storyId, story } = useMemo(() => {
    const selected = model.getSelectedStory();

    return {
      storyId: selected.storyId ?? null,
      story: selected.story ?? null,
    };
  }, [model, revision]);

  const updateStory = useCallback(
    (patch: Partial<IJGISStoryMap>) => {
      if (!storyId || !story) {
        return;
      }

      model.sharedModel.updateStoryMap(storyId, {
        ...story,
        ...patch,
        storySegments: story.storySegments ?? [],
      });
    },
    [model, storyId, story],
  );

  const segments = useMemo(
    () => buildStorySegmentViewItems(model, story),
    [model, story, revision],
  );

  const selectedSegmentId = useMemo(() => {
    const segmentIds = story?.storySegments;
    if (!segmentIds?.length) {
      return null;
    }
    const index = model.getCurrentSegmentIndex() ?? 0;
    return segmentIds[index] ?? segmentIds[0] ?? null;
  }, [model, story, revision]);

  const selectedSegment = useMemo(
    () => segments.find(segment => segment.id === selectedSegmentId) ?? null,
    [segments, selectedSegmentId],
  );

  const selectSegment = useCallback(
    (segmentId: string) => {
      const index = story?.storySegments?.indexOf(segmentId) ?? -1;
      if (index >= 0) {
        model.setCurrentSegmentIndex(index);
      }
    },
    [model, story],
  );

  const addSegment = useCallback(() => {
    void commands.execute(CommandIDs.addStorySegment);
  }, [commands]);

  const canRemoveSegment = segments.length > 1;

  const removeSegment = useCallback(() => {
    if (
      !selectedSegmentId ||
      !story?.storySegments ||
      story.storySegments.length <= 1
    ) {
      return;
    }

    const currentIndex = model.getCurrentSegmentIndex();
    model.removeLayer(selectedSegmentId);

    const remainingCount =
      model.getSelectedStory().story?.storySegments?.length ?? 0;

    model.setCurrentSegmentIndex(
      remainingCount === 0 ? 0 : Math.min(currentIndex, remainingCount - 1),
    );
  }, [model, selectedSegmentId, story]);

  const reorderSegments = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        !storyId ||
        !story?.storySegments ||
        story.storySegments.length <= 1 ||
        fromIndex === toIndex
      ) {
        return;
      }

      const segmentIds = story.storySegments;

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= segmentIds.length ||
        toIndex >= segmentIds.length
      ) {
        return;
      }

      const nextSegmentIds = [...segmentIds];
      const [movedId] = nextSegmentIds.splice(fromIndex, 1);
      nextSegmentIds.splice(toIndex, 0, movedId);

      model.sharedModel.updateStoryMap(storyId, {
        ...story,
        storySegments: nextSegmentIds,
      });

      const currentIndex = model.getCurrentSegmentIndex() ?? 0;
      const currentId = segmentIds[currentIndex];
      const nextIndex = nextSegmentIds.indexOf(currentId);
      if (nextIndex >= 0) {
        model.setCurrentSegmentIndex(nextIndex);
      }
    },
    [model, storyId, story],
  );

  const updateSegmentContentMode = useCallback(
    (segmentId: string, mode: StorySegmentDisplayMode) => {
      applySegmentContentMode(model, segmentId, mode);
    },
    [model],
  );

  const updateSegmentContent = useCallback(
    (segmentId: string, patch: SegmentContentPatch) => {
      applySegmentContent(model, segmentId, patch);
    },
    [model],
  );

  const updateSegmentTransition = useCallback(
    (segmentId: string, patch: SegmentTransitionPatch) => {
      applySegmentTransition(model, segmentId, patch);
    },
    [model],
  );

  return {
    storyId,
    story,
    segments,
    selectedSegmentId,
    selectedSegment,
    selectSegment,
    addSegment,
    removeSegment,
    canRemoveSegment,
    reorderSegments,
    updateStory,
    updateSegmentContentMode,
    updateSegmentContent,
    updateSegmentTransition,
  };
}
