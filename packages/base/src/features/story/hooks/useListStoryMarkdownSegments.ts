import type { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useMemo, useState } from 'react';

import {
  getListStoryMarkdownSegments,
  type IListStoryMarkdownSegment,
} from '@/src/features/story/utils/listStoryMarkdownSegments';

export function useListStoryMarkdownSegments(
  model: IJupyterGISModel,
): IListStoryMarkdownSegment[] {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const bump = (): void => {
      setRevision(value => value + 1);
    };
    model.sharedModel.storyMapsChanged.connect(bump);
    model.sharedModel.layersChanged.connect(bump);
    return () => {
      model.sharedModel.storyMapsChanged.disconnect(bump);
      model.sharedModel.layersChanged.disconnect(bump);
    };
  }, [model]);

  return useMemo(
    () => getListStoryMarkdownSegments(model),
    [model, revision],
  );
}
