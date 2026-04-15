import { IJGISUIState, IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

import { GlobalStateDbManager } from '../../../store';

const STATE_DB_KEY_PREFIX = 'jupytergis:localUIState:';

export function useUIState<K extends keyof IJGISUIState>(
  key: K,
  model: IJupyterGISModel,
): [IJGISUIState[K], (value: IJGISUIState[K]) => void] {
  const [value, setValue] = React.useState<IJGISUIState[K]>(
    () => model.getUIState()[key],
  );

  // Listen for model uiState changes and persist to StateDB
  React.useEffect(() => {
    const handler = (_: IJupyterGISModel, state: IJGISUIState) => {
      setValue(state[key]);
      const stateDb = GlobalStateDbManager.getInstance().getStateDb();
      if (stateDb) {
        stateDb.save(`${STATE_DB_KEY_PREFIX}${model.filePath}`, state as any);
      }
    };
    model.uiStateChanged.connect(handler);
    return () => {
      model.uiStateChanged.disconnect(handler);
    };
  }, [model, key]);

  const setUIStateValue = React.useCallback(
    (newValue: IJGISUIState[K]) => {
      setValue(newValue);
      model.setUIState({ [key]: newValue } as Partial<IJGISUIState>);
    },
    [model, key],
  );

  return [value, setUIStateValue];
}
