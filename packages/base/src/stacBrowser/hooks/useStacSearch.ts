import { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

interface IUseGenericProps {
  model: IJupyterGISModel | undefined;
}

interface IUseGenericReturn {
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
 * Custom hook for managing generic STAC search state (temporal and spatial filters)
 * @param props - Configuration object containing model
 * @returns Object containing state and setters for temporal and spatial filters
 */
export function useGeneric({ model }: IUseGenericProps): IUseGenericReturn {
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
