import type { IDict } from '@jupytergis/schema';

export interface IDrawFeatureAttributes {
  featureId: string;
  attributes: IDict<any>;
}

export interface IDrawToolAdapter {
  readonly currentDrawLayerId: string | undefined;
  readonly currentDrawSourceId: string | undefined;
  handleGeometryTypeChange(drawGeometryLabel: string): void;
  enterLayer(): void;
  leaveDrawMode(): void;
  deleteAtCoordinate(coordinate: number[]): boolean;
  toggleDeleteMode(): void;
  getFeatureAtCoordinate(
    coordinate: number[],
  ): IDrawFeatureAttributes | undefined;
  updateFeatureAttributes(featureId: string, attributes: IDict<any>): boolean;
  hasFeatureAtCoordinate(coordinate: number[]): boolean;
  setDrawLayerId(layerId: string): void;
}
