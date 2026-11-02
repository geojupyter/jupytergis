/**
 * Per-model registry of layers the active map adapter could not render.
 *
 * The map adapter reports failures to MainView (`onLayerError`), but the
 * layer panel is a separate component that only receives the model. This
 * registry is the bridge: MainView writes, the panel subscribes with
 * `useLayerError` and greys the layer out.
 *
 * Errors belong to the active adapter, so MainView clears them when the
 * adapter is torn down. A layer clears its own error when the adapter
 * reports it loaded (`onLayerLoaded`).
 */

import type { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

type LayerErrors = Readonly<Record<string, string>>;

const errorsByModel = new WeakMap<IJupyterGISModel, LayerErrors>();
const listenersByModel = new WeakMap<IJupyterGISModel, Set<() => void>>();

const notify = (model: IJupyterGISModel): void => {
  listenersByModel.get(model)?.forEach(listener => listener());
};

export function getLayerError(
  model: IJupyterGISModel,
  layerId: string,
): string | undefined {
  return errorsByModel.get(model)?.[layerId];
}

export function setLayerError(
  model: IJupyterGISModel,
  layerId: string,
  message: string,
): void {
  const current = errorsByModel.get(model) ?? {};
  if (current[layerId] === message) {
    return;
  }
  errorsByModel.set(model, { ...current, [layerId]: message });
  notify(model);
}

export function clearLayerError(
  model: IJupyterGISModel,
  layerId: string,
): void {
  const current = errorsByModel.get(model);
  if (!current || !(layerId in current)) {
    return;
  }
  const { [layerId]: _, ...rest } = current;
  errorsByModel.set(model, rest);
  notify(model);
}

export function clearLayerErrors(model: IJupyterGISModel): void {
  const current = errorsByModel.get(model);
  if (!current || Object.keys(current).length === 0) {
    return;
  }
  errorsByModel.set(model, {});
  notify(model);
}

/** The adapter's error for a layer, or undefined when it loaded fine. */
export function useLayerError(
  model: IJupyterGISModel | undefined,
  layerId: string,
): string | undefined {
  const [error, setError] = useState<string | undefined>(() =>
    model ? getLayerError(model, layerId) : undefined,
  );

  useEffect(() => {
    if (!model) {
      return;
    }
    const update = () => setError(getLayerError(model, layerId));

    let listeners = listenersByModel.get(model);
    if (!listeners) {
      listeners = new Set();
      listenersByModel.set(model, listeners);
    }
    listeners.add(update);
    update(); // pick up anything reported between render and subscribe

    return () => {
      listeners?.delete(update);
    };
  }, [model, layerId]);

  return error;
}
