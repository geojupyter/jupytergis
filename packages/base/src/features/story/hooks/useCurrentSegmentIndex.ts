import type { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

/** Subscribes to model's current story segment index for a single source of truth */
export function useCurrentSegmentIndex(model: IJupyterGISModel): number {
  const [currentIndex, setCurrentIndex] = useState(
    () => model.getCurrentSegmentIndex() ?? 0,
  );

  useEffect(() => {
    const handler = (_sender: IJupyterGISModel, index: number): void => {
      setCurrentIndex(Math.max(0, index ?? 0));
    };
    model.currentSegmentIndexChanged.connect(handler);
    setCurrentIndex(model.getCurrentSegmentIndex() ?? 0);

    return () => {
      model.currentSegmentIndexChanged.disconnect(handler);
    };
  }, [model]);

  return currentIndex;
}
