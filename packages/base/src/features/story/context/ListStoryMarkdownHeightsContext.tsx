import type { IJupyterGISModel } from '@jupytergis/schema';
import React, { createContext, useCallback, useContext, useState } from 'react';

import { ListStoryMarkdownMeasureHost } from '@/src/features/story/components/ListStoryMarkdownMeasureHost';
import { useListStoryMarkdownSegments } from '@/src/features/story/hooks/useListStoryMarkdownSegments';
import type { IListStoryMarkdownSegment } from '@/src/features/story/utils/listStoryMarkdownSegments';

export type ListStoryMarkdownHeights = Readonly<Record<string, number>>;

const ListStoryMarkdownHeightsContext =
  createContext<ListStoryMarkdownHeights>({});

export interface IListStoryMarkdownHeightsProviderProps {
  model: IJupyterGISModel;
  children: React.ReactNode;
}

export function ListStoryMarkdownHeightsProvider({
  model,
  children,
}: IListStoryMarkdownHeightsProviderProps): JSX.Element {
  const [heights, setHeights] = useState<ListStoryMarkdownHeights>({});
  const segments = useListStoryMarkdownSegments(model);

  const handleHeight = useCallback((segmentId: string, height: number) => {
    const rounded = Math.ceil(height);
    setHeights(prev =>
      prev[segmentId] === rounded ? prev : { ...prev, [segmentId]: rounded },
    );
  }, []);

  return (
    <ListStoryMarkdownHeightsContext.Provider value={heights}>
      {children}
      <ListStoryMarkdownMeasureHost
        segments={segments}
        onHeight={handleHeight}
      />
    </ListStoryMarkdownHeightsContext.Provider>
  );
}

export function useListStoryMarkdownHeights(): ListStoryMarkdownHeights {
  return useContext(ListStoryMarkdownHeightsContext);
}

export function useListStoryMarkdownPaneHeight(
  segmentId: string | undefined,
): number | undefined {
  const heights = useListStoryMarkdownHeights();
  if (!segmentId) {
    return undefined;
  }
  return heights[segmentId];
}

export type { IListStoryMarkdownSegment };
