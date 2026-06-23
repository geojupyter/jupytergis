import type { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';

export const DEFAULT_SEGMENT_TRANSITION: IStorySegmentLayer['transition'] = {
  type: 'linear',
  time: 1,
};

export const MIN_SEGMENT_TRANSITION_TIME = 0;
export const MAX_SEGMENT_TRANSITION_TIME = 3;
export const SEGMENT_TRANSITION_TIME_STEP = 0.1;

export type SegmentTransitionPatch = Partial<IStorySegmentLayer['transition']>;

export function getSegmentTransitionTime(
  transition: IStorySegmentLayer['transition'] | undefined,
): number {
  return transition?.time ?? DEFAULT_SEGMENT_TRANSITION.time;
}

export function formatSegmentTransitionTime(time: number): string {
  return `${time.toFixed(1)}s`;
}

export function updateSegmentTransition(
  model: IJupyterGISModel,
  segmentId: string,
  patch: SegmentTransitionPatch,
): boolean {
  const layer = model.getLayer(segmentId);

  if (!layer || layer.type !== 'StorySegmentLayer') {
    return false;
  }

  const parameters = layer.parameters as IStorySegmentLayer;
  const current = parameters.transition ?? DEFAULT_SEGMENT_TRANSITION;

  model.sharedModel.updateObjectParameters(segmentId, {
    transition: {
      ...current,
      ...patch,
    },
  });

  return true;
}
