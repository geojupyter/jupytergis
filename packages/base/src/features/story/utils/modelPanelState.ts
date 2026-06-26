import type { IJGISUIState, IJupyterGISModel } from '@jupytergis/schema';

export function modelHasHiddenPanel(model: IJupyterGISModel): boolean {
  const { leftPanelDisabled, rightPanelDisabled } = model.jgisSettings;
  const { leftPanelOpen = true, rightPanelOpen = true } = model.getUIState();

  return (
    (!leftPanelDisabled && !leftPanelOpen) ||
    (!rightPanelDisabled && !rightPanelOpen)
  );
}

export function modelHasOpenPanel(model: IJupyterGISModel): boolean {
  const { leftPanelDisabled, rightPanelDisabled } = model.jgisSettings;
  const { leftPanelOpen = true, rightPanelOpen = true } = model.getUIState();

  return (
    (!leftPanelDisabled && leftPanelOpen) ||
    (!rightPanelDisabled && rightPanelOpen)
  );
}

function buildPanelState(
  model: IJupyterGISModel,
  open: boolean,
): Partial<IJGISUIState> | null {
  const { leftPanelDisabled, rightPanelDisabled } = model.jgisSettings;
  const newState: Partial<IJGISUIState> = {};

  if (!leftPanelDisabled) {
    newState.leftPanelOpen = open;
  }
  if (!rightPanelDisabled) {
    newState.rightPanelOpen = open;
  }

  return Object.keys(newState).length > 0 ? newState : null;
}

/** Sets all non-disabled panels open or closed. Returns true if state changed. */
export function setModelPanelsOpen(
  model: IJupyterGISModel,
  open: boolean,
): boolean {
  const shouldChange = open
    ? modelHasHiddenPanel(model)
    : modelHasOpenPanel(model);

  if (!shouldChange) {
    return false;
  }

  const newState = buildPanelState(model, open);
  if (!newState) {
    return false;
  }

  model.setUIState(newState);
  return true;
}

/** Show all panels if any are hidden; otherwise hide all. */
export function toggleModelPanels(model: IJupyterGISModel): void {
  setModelPanelsOpen(model, modelHasHiddenPanel(model));
}
