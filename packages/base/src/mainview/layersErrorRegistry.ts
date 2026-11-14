/**
 * Per-model registry of layers the active map adapter could not render.
 *
 * The map adapter reports failures to MainView (`onLayerError`), but the
 * layer panel is a separate component that only receives the model. This
 * registry is the bridge: MainView writes, the panel subscribes with
 * `useLayerError` and greys the layer out.
 *
 * A warning means the layer is on the map but its data failed to load
 * (`onSourceDataError`). The panel flags it without greying it out, until
 * the data loads (`onSourceDataLoaded`).
 *
 * Errors belong to the active adapter, so MainView clears them when the
 * adapter is torn down. A layer clears its own error when the adapter
 * reports it loaded (`onLayerLoaded`).
 */

import type { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

export type LayerError = Readonly<{
  message: string;
  level: 'error' | 'warning';
}>;

type LayerErrors = Readonly<Record<string, LayerError>>;

const errorsByModel = new WeakMap<IJupyterGISModel, LayerErrors>();
const listenersByModel = new WeakMap<IJupyterGISModel, Set<() => void>>();

const notify = (model: IJupyterGISModel): void => {
  listenersByModel.get(model)?.forEach(listener => listener());
};

export function getLayerError(
  model: IJupyterGISModel,
  layerId: string,
): LayerError | undefined {
  return errorsByModel.get(model)?.[layerId];
}

export function setLayerError(
  model: IJupyterGISModel,
  layerId: string,
  message: string,
  level: LayerError['level'] = 'error',
): void {
  const current = errorsByModel.get(model) ?? {};
  const existing = current[layerId];
  if (
    (existing?.message === message && existing.level === level) ||
    (existing?.level === 'error' && level === 'warning')
  ) {
    return;
  }
  errorsByModel.set(model, { ...current, [layerId]: { message, level } });
  notify(model);
}

export function clearLayerError(
  model: IJupyterGISModel,
  layerId: string,
  level?: LayerError['level'],
): void {
  const current = errorsByModel.get(model);
  if (
    !current ||
    !(layerId in current) ||
    (level && current[layerId].level !== level)
  ) {
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
): LayerError | undefined {
  const [error, setError] = useState<LayerError | undefined>(() =>
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
