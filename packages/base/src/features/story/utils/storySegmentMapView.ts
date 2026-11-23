import type { IJupyterGISModel } from '@jupytergis/schema';

export function updateSegmentMapView(
  model: IJupyterGISModel,
  segmentId: string,
): boolean {
  const layer = model.getLayer(segmentId);

  if (!layer || layer.type !== 'StorySegmentLayer') {
    return false;
  }

  const { zoom, extent, pitch, bearing } = model.getOptions();

  if (zoom === undefined || !extent?.length) {
    return false;
  }

  model.sharedModel.updateLayer(segmentId, {
    ...layer,
    parameters: {
      ...layer.parameters,
      zoom,
      extent,
      pitch,
      bearing,
    },
  });

  return true;
}
