import type { IJupyterGISModel } from '@jupytergis/schema';

import type { JupyterGISTracker } from '@/src/types';
import { JupyterGISPanel } from '@/src/workspace/widget';

export function resolveMainViewContainer(
  tracker: JupyterGISTracker,
  model: IJupyterGISModel,
): HTMLElement | null {
  const widget = tracker.find(w => w.model === model);
  const panel = widget?.content;
  if (!(panel instanceof JupyterGISPanel)) {
    return null;
  }

  return (
    panel.jupyterGISMainViewPanel?.node.querySelector<HTMLElement>(
      '.jGIS-Mainview-Container',
    ) ?? null
  );
}
