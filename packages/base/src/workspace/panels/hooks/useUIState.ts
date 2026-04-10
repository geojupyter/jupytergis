import { IJGISUIState, IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

/**
 * Read and write a single uiState field, backed by the model.
 *
 * The model handles syncUIState routing: when sync is disabled it stores
 * changes locally (in-memory) and emits the signal without touching the
 * shared document, so remote peers are unaffected.
 */
export function useUIState<K extends keyof IJGISUIState>(
  key: K,
  model: IJupyterGISModel,
): [IJGISUIState[K], (value: IJGISUIState[K]) => void] {
  const [value, setValue] = React.useState<IJGISUIState[K]>(
    () => model.getUIState()[key],
  );

  React.useEffect(() => {
    const handler = (_: IJupyterGISModel, state: IJGISUIState) => {
      setValue(state[key]);
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
