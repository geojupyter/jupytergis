import type { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';

import { getSegmentDisplayMode } from '@/src/features/story/utils/segmentDisplayMode';

export interface IListStoryMarkdownSegment {
  id: string;
  index: number;
  markdown: string;
}

export function getListStoryMarkdownSegments(
  model: IJupyterGISModel,
): IListStoryMarkdownSegment[] {
  const story = model.getSelectedStory().story;
  const segmentIds = story?.storySegments ?? [];
  const segments: IListStoryMarkdownSegment[] = [];

  segmentIds.forEach((id, index) => {
    const layer = model.getLayer(id);
    if (layer?.type !== 'StorySegmentLayer') {
      return;
    }
    const parameters = layer.parameters as IStorySegmentLayer['parameters'];
    if (getSegmentDisplayMode(parameters) !== 'markdown') {
      return;
    }
    const markdown = parameters?.content?.markdown;
    segments.push({
      id,
      index,
      markdown: typeof markdown === 'string' ? markdown : '',
    });
  });

  return segments;
}
