import { IJGISUIState, IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

/**
 * Read and write a single uiState field.
 *
 * When syncUIState is true the value is backed by the shared document model:
 * remote changes are applied and local changes are written back.
 *
 * When syncUIState is false the value is local React state only, initialised
 * from the document on mount. Changes stay in memory and are lost on reload.
 */
export function useUIState<K extends keyof IJGISUIState>(
  key: K,
  model: IJupyterGISModel,
  syncUIState: boolean,
): [IJGISUIState[K], (value: IJGISUIState[K]) => void] {
  const [value, setValue] = React.useState<IJGISUIState[K]>(
    () => model.getUIState()[key],
  );

  React.useEffect(() => {
    if (!syncUIState) {
      return;
    }
    const handler = (_: IJupyterGISModel, state: IJGISUIState) => {
      setValue(state[key]);
    };
    model.uiStateChanged.connect(handler);
    return () => {
      model.uiStateChanged.disconnect(handler);
    };
  }, [model, key, syncUIState]);

  const setUIStateValue = React.useCallback(
    (newValue: IJGISUIState[K]) => {
      setValue(newValue);
      if (syncUIState) {
        model.setUIState({ [key]: newValue } as Partial<IJGISUIState>);
      }
    },
    [model, key, syncUIState],
  );

  return [value, setUIStateValue];
}
