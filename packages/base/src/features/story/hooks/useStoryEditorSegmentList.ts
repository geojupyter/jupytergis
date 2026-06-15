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

function getSingleSelectedLayerId(
  selected: Record<string, unknown> | null | undefined,
): string | null {
  if (!selected) {
    return null;
  }

  const selectedLayerIds = Object.keys(selected);
  if (selectedLayerIds.length !== 1) {
    return null;
  }

  return selectedLayerIds[0];
}

function resolveSelectedSegmentId(
  model: IJupyterGISModel,
  story: IJGISStoryMap | null,
): string | null {
  const segmentIds = story?.storySegments ?? [];
  if (segmentIds.length === 0) {
    return null;
  }

  const selectedLayerId = getSingleSelectedLayerId(
    model.localState?.selected?.value,
  );

  if (
    selectedLayerId &&
    segmentIds.includes(selectedLayerId) &&
    model.getLayer(selectedLayerId)?.type === 'StorySegmentLayer'
  ) {
    return selectedLayerId;
  }

  const currentIndex = model.getCurrentSegmentIndex();
  const fromIndex = segmentIds[currentIndex];
  if (fromIndex) {
    return fromIndex;
  }

  return segmentIds[0] ?? null;
}

interface IUseStoryEditorSegmentListResult {
  storyId: string | null;
  story: IJGISStoryMap | null;
  segments: IStorySegmentViewItem[];
  selectedSegmentId: string | null;
  selectedSegment: IStorySegmentViewItem | null;
  selectSegment: (segmentId: string) => void;
  addSegment: () => void;
  updateStory: (patch: Partial<IJGISStoryMap>) => void;
  updateSegmentContentMode: (
    segmentId: string,
    mode: StorySegmentDisplayMode,
  ) => void;
  updateSegmentContent: (
    segmentId: string,
    patch: SegmentContentPatch,
  ) => void;
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
    model.sharedModel.layerTreeChanged.connect(bump);
    model.sharedModel.storyMapsChanged.connect(bump);
    model.selectedChanged.connect(bump);
    model.currentSegmentIndexChanged.connect(bump);
    model.segmentAdded.connect(bump);

    return () => {
      model.sharedModel.layersChanged.disconnect(bump);
      model.sharedModel.layerTreeChanged.disconnect(bump);
      model.sharedModel.storyMapsChanged.disconnect(bump);
      model.selectedChanged.disconnect(bump);
      model.currentSegmentIndexChanged.disconnect(bump);
      model.segmentAdded.disconnect(bump);
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
    [model, story],
  );

  const selectedSegmentId = useMemo(
    () => resolveSelectedSegmentId(model, story),
    [model, story, revision],
  );

  const selectedSegment = useMemo(
    () => segments.find(segment => segment.id === selectedSegmentId) ?? null,
    [segments, selectedSegmentId],
  );

  const selectSegment = useCallback(
    (segmentId: string) => {
      model.syncSelected(
        { [segmentId]: { type: 'layer' } },
        model.getClientId().toString(),
      );

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

  useEffect(() => {
    const handleSegmentAdded = (
      _sender: IJupyterGISModel,
      payload: { storySegmentId: string },
    ): void => {
      model.syncSelected(
        { [payload.storySegmentId]: { type: 'layer' } },
        model.getClientId().toString(),
      );
    };

    model.segmentAdded.connect(handleSegmentAdded);

    return () => {
      model.segmentAdded.disconnect(handleSegmentAdded);
    };
  }, [model]);

  return {
    storyId,
    story,
    segments,
    selectedSegmentId,
    selectedSegment,
    selectSegment,
    addSegment,
    updateStory,
    updateSegmentContentMode,
    updateSegmentContent,
    updateSegmentTransition,
  };
}
