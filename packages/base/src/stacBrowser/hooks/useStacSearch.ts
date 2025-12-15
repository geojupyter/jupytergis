import { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

import { GlobalStateDbManager } from '@/src/store';

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

interface IStacSearchStateDb {
  startTime?: string;
  endTime?: string;
  useWorldBBox?: boolean;
}

const STAC_SEARCH_STATE_KEY = 'jupytergis:stac-search-state';

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

  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  // Load saved state from StateDB on mount
  useEffect(() => {
    async function loadStacSearchStateFromDb() {
      const savedState = (await stateDb?.fetch(
        STAC_SEARCH_STATE_KEY,
      )) as IStacSearchStateDb | undefined;

      if (savedState) {
        if (savedState.startTime) {
          setStartTime(new Date(savedState.startTime));
        }
        if (savedState.endTime) {
          setEndTime(new Date(savedState.endTime));
        }
        if (savedState.useWorldBBox !== undefined) {
          setUseWorldBBox(savedState.useWorldBBox);
        }
      }
    }

    loadStacSearchStateFromDb();
  }, [stateDb]);

  // Save state to StateDB on change
  useEffect(() => {
    async function saveStacSearchStateToDb() {
      await stateDb?.save(STAC_SEARCH_STATE_KEY, {
        startTime: startTime?.toISOString(),
        endTime: endTime?.toISOString(),
        useWorldBBox,
      });
    }

    saveStacSearchStateToDb();
  }, [startTime, endTime, useWorldBBox, stateDb]);

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
