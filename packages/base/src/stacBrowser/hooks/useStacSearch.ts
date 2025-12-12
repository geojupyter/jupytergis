import { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

interface IUseStacSearchProps {
  model: IJupyterGISModel | undefined;
}

interface IUseStacSearchReturn {
  startTime: Date | undefined;
  setStartTime: (date: Date | undefined) => void;
  endTime: Date | undefined;
  setEndTime: (date: Date | undefined) => void;
  currentBBox: [number, number, number, number];
  setCurrentBBox: (bbox: [number, number, number, number]) => void;
  useWorldBBox: boolean;
  setUseWorldBBox: (val: boolean) => void;
}

/**
 * Base hook for managing STAC search - handles temporal/spatial filters
 */
export function useStacSearch({
  model,
}: IUseStacSearchProps): IUseStacSearchReturn {
  const [startTime, setStartTime] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState<Date | undefined>(undefined);
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([-180, -90, 180, 90]);
  const [useWorldBBox, setUseWorldBBox] = useState(false);

  // Listen for model updates to get current bounding box
  useEffect(() => {
    const listenToModel = (
      _sender: IJupyterGISModel,
      bBoxIn4326: [number, number, number, number],
    ) => {
      if (useWorldBBox) {
        setCurrentBBox([-180, -90, 180, 90]);
      } else {
        setCurrentBBox(bBoxIn4326);
      }
    };

    model?.updateBboxSignal.connect(listenToModel);

    return () => {
      model?.updateBboxSignal.disconnect(listenToModel);
    };
  }, [model, useWorldBBox]);

  return {
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    currentBBox,
    setCurrentBBox,
    useWorldBBox,
    setUseWorldBBox,
  };
}
