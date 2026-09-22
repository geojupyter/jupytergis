/**
 * Engine-agnostic draw / edit API used by MainView via the map adapter.
 */
export interface IDrawToolAdapter {
  readonly currentDrawLayerId: string | undefined;
  readonly currentDrawSourceId: string | undefined;
  handleGeometryTypeChange(drawGeometryLabel: string): void;
  enterLayer(): void;
  leaveDrawMode(): void;
  deleteAtCoordinate(coordinate: number[]): boolean;
  hasFeatureAtCoordinate(coordinate: number[]): boolean;
  setDrawLayerId(layerId: string): void;
}
