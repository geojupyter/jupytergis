import type {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';

export interface IStorySegmentViewItem {
  id: string;
  index: number;
  layerName: string;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
}

export function buildStorySegmentViewItems(
  model: IJupyterGISModel,
  storyData: IJGISStoryMap | null,
): IStorySegmentViewItem[] {
  const segments = storyData?.storySegments ?? [];

  return segments.map((segmentId, index) => {
    const layer = model.getLayer(segmentId);
    return {
      id: segmentId,
      index,
      layerName: layer?.name ?? `Segment ${index + 1}`,
      activeSlide: layer?.parameters as
        | IStorySegmentLayer['parameters']
        | undefined,
    };
  });
}
