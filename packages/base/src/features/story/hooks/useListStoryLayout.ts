import { RefObject, useLayoutEffect, useMemo, useState } from 'react';

import type { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';
import {
  buildListStoryLayout,
  type IListStoryLayout,
} from '@/src/features/story/utils/listStoryLayout';

export interface IUseListStoryLayoutParams {
  items: IStorySegmentViewItem[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** Measured heights from lazy measure pass (phase C); empty for phase B. */
  heightsById?: Readonly<Record<string, number>>;
}

export function useListStoryLayout({
  items,
  scrollContainerRef,
  heightsById = {},
}: IUseListStoryLayoutParams): IListStoryLayout | null {
  const [viewportHeight, setViewportHeight] = useState(0);

  useLayoutEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) {
      return;
    }

    const update = (): void => {
      setViewportHeight(scroller.clientHeight);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    return () => {
      ro.disconnect();
    };
  }, [scrollContainerRef]);

  return useMemo(
    () =>
      buildListStoryLayout({
        items,
        viewportHeight,
        heightsById,
      }),
    [items, viewportHeight, heightsById],
  );
}
