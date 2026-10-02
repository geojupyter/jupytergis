import type { IJupyterGISModel } from '@jupytergis/schema';
import { Signal } from '@lumino/signaling';

import type { IMapAdapterFeatures } from './mapAdapterFeatures';

const registry = new WeakMap<IJupyterGISModel, IMapAdapterFeatures>();

export const mapFeaturesChanged = new Signal<object, IJupyterGISModel>({});

export function setMapFeatures(
  model: IJupyterGISModel,
  features: IMapAdapterFeatures | undefined,
): void {
  if (features) {
    registry.set(model, features);
  } else {
    registry.delete(model);
  }
  mapFeaturesChanged.emit(model);
}

/** `undefined` means no adapter yet: callers should not restrict anything. */
export function getMapFeatures(
  model?: IJupyterGISModel,
): IMapAdapterFeatures | undefined {
  return model ? registry.get(model) : undefined;
}
