import { Map as OlMap, View } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import { get as getProjection } from 'ol/proj';

import { IMapViewer, IMapViewerOptions } from '@/src/mainview/mapviewer';

/**
 * Wrapper around OpenLayers Map that conforms to IMapViewer interface.
 */
export class OpenLayersViewer implements IMapViewer {
  private map: OlMap | null = null;

  async initialize(
    target: HTMLElement,
    options: IMapViewerOptions,
  ): Promise<void> {
    const {
      projection = 'EPSG:3857',
      center = [0, 0],
      zoom = 1,
      rotation = 0,
    } = options;

    const proj = getProjection(projection);
    if (!proj) {
      throw new Error(`Invalid projection: ${projection}`);
    }

    this.map = new OlMap({
      target,
      view: new View({
        center,
        zoom,
        rotation,
        projection: proj,
      }),
      keyboardEventTarget: document,
    });

    // Ensure map is fully initialized
    await new Promise(resolve => {
      this.map?.once('loadend', resolve);
      setTimeout(resolve, 100);
    });
  }

  destroy(): void {
    if (this.map) {
      this.map.setTarget(undefined);
      this.map = null;
    }
  }

  getCenter(): Coordinate | undefined {
    return this.map?.getView().getCenter() || undefined;
  }

  setCenter(center: Coordinate): void {
    if (!this.map) {
      return;
    }
    this.map.getView().setCenter(center);
  }

  getZoom(): number | undefined {
    return this.map?.getView().getZoom() ?? undefined;
  }

  setZoom(zoom: number): void {
    if (!this.map) {
      return;
    }
    this.map.getView().setZoom(zoom);
  }

  getRotation(): number {
    return this.map?.getView().getRotation() ?? 0;
  }

  setRotation(rotation: number): void {
    if (!this.map) {
      return;
    }
    this.map.getView().setRotation(rotation);
  }

  getProjection(): string {
    return this.map?.getView().getProjection().getCode() ?? 'EPSG:3857';
  }

  getViewport(): HTMLElement | undefined {
    return this.map?.getViewport() ?? undefined;
  }

  // OL-specific access (for cases not covered by abstraction)
  getMap(): OlMap | null {
    return this.map;
  }
}
