import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { transformExtent } from 'ol/proj';
import { useRef, useState } from 'react';

export interface IUseMapExtentResult {
  isActive: boolean;
  extentRef: React.MutableRefObject<IDict>;
  toggle: (checked: boolean) => IDict | null;
}

/**
 * Reads the current map viewport from the model awareness and returns the
 * bounding box in EPSG:4326, or null if the viewport is not yet available.
 */
export function getMapExtent(model: IJupyterGISModel): IDict | null {
  const viewport =
    model.sharedModel.awareness.getLocalState()?.viewportState?.value;
  if (!viewport?.extent) {
    return null;
  }
  const mapProjection =
    (model.sharedModel.options as any)?.projection ?? 'EPSG:3857';
  let [xMin, yMin, xMax, yMax] = viewport.extent;
  if (mapProjection !== 'EPSG:4326') {
    [xMin, yMin, xMax, yMax] = transformExtent(
      viewport.extent,
      mapProjection,
      'EPSG:4326',
    );
  }
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return {
    xMin: round(xMin),
    yMin: round(yMin),
    xMax: round(xMax),
    yMax: round(yMax),
  };
}

/**
 * Manages the "Use current map extent" toggle state.
 *
 * Returns:
 * - `isActive`: whether the map extent is currently locked in
 * - `extentRef`: cached extent values (used to restore fields after rjsf re-renders)
 * - `toggle(checked)`: call when the checkbox changes; returns the extent dict
 *   when activating (so the caller can merge it into form state), or null when
 *   deactivating or when the viewport is not yet ready.
 */
export function useMapExtent(model: IJupyterGISModel): IUseMapExtentResult {
  const [isActive, setIsActive] = useState(false);
  const extentRef = useRef<IDict>({});

  const toggle = (checked: boolean): IDict | null => {
    if (checked) {
      const extent = getMapExtent(model);
      if (extent) {
        extentRef.current = extent;
        setIsActive(true);
        return extent;
      }
      // Viewport not ready — leave checkbox unchecked, fields stay required
      return null;
    } else {
      setIsActive(false);
      extentRef.current = {};
      return null;
    }
  };

  return { isActive, extentRef, toggle };
}
