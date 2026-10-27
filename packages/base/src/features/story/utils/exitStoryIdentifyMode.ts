import type { IJupyterGISModel } from '@jupytergis/schema';

/**
 * Leave identify mode and clear floaters/highlight state for story presentation.
 */
export function exitStoryIdentifyMode(model: IJupyterGISModel): void {
  if (model.currentMode === 'identifying') {
    model.currentMode = 'panning';
  }

  model.syncIdentifiedFeatures([], model.getClientId().toString());
}
