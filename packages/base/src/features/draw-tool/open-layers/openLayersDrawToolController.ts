import type {
  IDrawCustomAttribute,
  IFeatureStoreGeometry,
  IFeatureStoreSource,
  IJGISSource,
  IDict,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { UUID } from '@lumino/coreutils';
import type { Map as OlMap } from 'ol';
import Feature, { type FeatureLike } from 'ol/Feature';
import { Coordinate } from 'ol/coordinate';
import { primaryAction, singleClick } from 'ol/events/condition';
import { GeoJSON } from 'ol/format';
import { Type } from 'ol/geom/Geometry';
import Draw, { DrawEvent } from 'ol/interaction/Draw';
import Interaction from 'ol/interaction/Interaction';
import Modify, { ModifyEvent } from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import { Layer } from 'ol/layer';
import RenderFeature from 'ol/render/Feature';
import { Vector as VectorSource } from 'ol/source';

import { applyDrawCustomAttributesToFeature } from '@/src/features/labels/drawCustomAttributes';
import type {
  IDrawFeatureAttributes,
  IDrawToolAdapter,
} from '../drawToolAdapter';
import { drawInteractionStyle } from './drawInteractionStyle';
import { getVectorSourceFromLayer, isDrawLayer } from './drawToolUtils';

export interface IDrawToolHost {
  getMap(): OlMap | undefined;
  getLayer(layerId: string): Layer | undefined;
  getModel(): IJupyterGISModel;
  getFeatureStoreOverlay(storeId: string): VectorSource | undefined;
  onDrawLayerIdChange(layerId: string | undefined): void;
  onDrawGeometryLabelChange(label: string): void;
  setModifyHighlight(features: Feature[]): void;
  log(
    level: 'debug' | 'info' | 'warning' | 'error' | 'critical',
    message: string,
  ): void;
}

export class OpenLayersDrawToolController implements IDrawToolAdapter {
  private _draw: Draw | undefined;
  private _snap: Snap | undefined;
  private _modify: Modify | undefined;
  private _deleteClick: Interaction | undefined;
  private _deleting = false;
  private _currentDrawLayerId: string | undefined;
  private _currentDrawSource: IJGISSource | undefined;
  private _currentVectorSource: VectorSource | undefined;
  private _currentDrawSourceId: string | undefined;
  private _currentDrawGeometry: Type | undefined;

  constructor(private readonly _host: IDrawToolHost) {}

  get currentDrawLayerId(): string | undefined {
    return this._currentDrawLayerId;
  }

  get currentDrawSourceId(): string | undefined {
    return this._currentDrawSourceId;
  }

  handleGeometryTypeChange(drawGeometryLabel: string): void {
    this._deleting = false;

    if (!drawGeometryLabel || this._currentDrawGeometry === drawGeometryLabel) {
      this._currentDrawGeometry = undefined;
      this._updateInteractions();
      this._host.onDrawGeometryLabelChange('');
      return;
    }

    this._currentDrawGeometry = drawGeometryLabel as Type;
    this._updateInteractions();
    this._host.onDrawGeometryLabelChange(drawGeometryLabel);
  }

  toggleDeleteMode(): void {
    this._deleting = !this._deleting;
    if (this._deleting) {
      this._currentDrawGeometry = undefined;
    }
    this._updateInteractions();
    this._host.onDrawGeometryLabelChange(this._deleting ? 'delete' : '');
  }

  enterLayer(): void {
    this._bindFromSelectedLayer();
    if (!this._currentDrawLayerId) {
      return;
    }

    this._updateInteractions();
  }

  leaveDrawMode(): void {
    this._removeInteractions();
    this._deleting = false;
    this._currentDrawGeometry = undefined;
    this._currentDrawLayerId = undefined;
    this._currentDrawSourceId = undefined;
    this._currentDrawSource = undefined;
    this._currentVectorSource = undefined;
    this._host.onDrawLayerIdChange(undefined);
    this._host.onDrawGeometryLabelChange('');
  }

  deleteAtCoordinate(coordinate: Coordinate): boolean {
    const map = this._host.getMap();
    if (!this._currentDrawLayerId || !map) {
      return false;
    }

    const source = this._resolveVectorSource(this._currentDrawLayerId);
    if (!source) {
      return false;
    }

    const pixel = map.getPixelFromCoordinate(coordinate);
    if (!pixel) {
      return false;
    }

    const hits = map.getFeaturesAtPixel(pixel, {
      hitTolerance: 10,
      layerFilter: layer => this._isDrawLayerFilter(layer),
    });

    if (hits.length === 0) {
      return false;
    }

    return this._deleteHits(source, hits);
  }

  getFeatureAtCoordinate(
    coordinate: Coordinate,
  ): IDrawFeatureAttributes | undefined {
    const map = this._host.getMap();
    if (!this._currentDrawLayerId || !map) {
      return undefined;
    }

    const pixel = map.getPixelFromCoordinate(coordinate);
    if (!pixel) {
      return undefined;
    }

    const hits = map.getFeaturesAtPixel(pixel, {
      hitTolerance: 10,
      layerFilter: layer => this._isDrawLayerFilter(layer),
    });

    for (const hit of hits) {
      if (!(hit instanceof Feature)) {
        continue;
      }

      const featureId = hit.get('_id');
      if (typeof featureId !== 'string') {
        continue;
      }

      const attributes: IDict<any> = { ...hit.getProperties() };
      delete attributes[hit.getGeometryName()];

      return { featureId, attributes };
    }

    return undefined;
  }

  updateFeatureAttributes(featureId: string, attributes: IDict<any>): boolean {
    if (!this._currentDrawLayerId) {
      return false;
    }

    const source = this._resolveVectorSource(this._currentDrawLayerId);
    const feature = source
      ?.getFeatures()
      .find(candidate => candidate.get('_id') === featureId);

    if (!source || !feature) {
      return false;
    }

    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined) {
        feature.unset(key);
        continue;
      }

      feature.set(key, value);
    }

    this._persist(source);

    return true;
  }

  hasFeatureAtCoordinate(coordinate: Coordinate): boolean {
    const map = this._host.getMap();
    if (!this._currentDrawLayerId || !map) {
      return false;
    }

    if (!this._resolveVectorSource(this._currentDrawLayerId)) {
      return false;
    }

    const pixel = map.getPixelFromCoordinate(coordinate);
    if (!pixel) {
      return false;
    }

    return map.hasFeatureAtPixel(pixel, {
      hitTolerance: 10,
      layerFilter: layer => this._isDrawLayerFilter(layer),
    });
  }

  setDrawLayerId(layerId: string): void {
    this._currentDrawLayerId = layerId;
    this._host.onDrawLayerIdChange(layerId);
  }

  private _deleteHits(source: VectorSource, hits: FeatureLike[]): boolean {
    const featureStoreIds: string[] = [];
    let removedFromSource = false;

    for (const hit of hits) {
      if (hit instanceof RenderFeature) {
        const baselineId = baselineFeatureId(hit);
        if (baselineId) {
          featureStoreIds.push(baselineId);
        }
        continue;
      }

      if (!(hit instanceof Feature)) {
        continue;
      }

      const featureId = hit.get('_id');
      const onSource =
        featureId !== undefined
          ? source
              .getFeatures()
              .find(feature => feature.get('_id') === featureId)
          : hit;
      const target = onSource ?? hit;

      if (source.hasFeature(target)) {
        source.removeFeature(target);
        removedFromSource = true;
      }

      const id = overlayFeatureId(target);
      if (id) {
        featureStoreIds.push(id);
      }
    }

    if (!removedFromSource && featureStoreIds.length === 0) {
      return false;
    }

    this._currentVectorSource = source;
    return this._commitDeletion(source, removedFromSource, featureStoreIds);
  }

  private _commitDeletion(
    source: VectorSource,
    removedFromSource: boolean,
    featureStoreIds: string[],
  ): boolean {
    if (!this._currentDrawSource && this._currentDrawLayerId) {
      this._bindFromSelectedLayer();
    }

    if (this._currentDrawSource?.type === 'FeatureStoreSource') {
      const storeId = (
        this._currentDrawSource.parameters as IFeatureStoreSource | undefined
      )?.storeId;
      const model = this._host.getModel();

      if (!storeId) {
        return false;
      }

      for (const featureId of featureStoreIds) {
        model.removeFeatureStoreFeature(storeId, featureId, {
          tombstone: true,
        });
      }

      return featureStoreIds.length > 0;
    }

    if (removedFromSource) {
      this._persist(source);
      return true;
    }

    return false;
  }

  private _bindFromSelectedLayer(): void {
    const model = this._host.getModel();
    const selectedLayers =
      model.sharedModel.awareness.getLocalState()?.selected?.value;

    if (!selectedLayers) {
      return;
    }

    const selectedLayerId = Object.keys(selectedLayers)[0];
    this._currentDrawLayerId = selectedLayerId;
    this._host.onDrawLayerIdChange(selectedLayerId);

    const jgisLayer = model.getLayer(selectedLayerId);
    this._currentDrawSourceId = (
      jgisLayer as { parameters?: { source?: string } }
    )?.parameters?.source;

    if (this._currentDrawSourceId) {
      this._currentDrawSource = model.getSource(this._currentDrawSourceId);
    }
  }

  private _resolveVectorSource(layerId: string): VectorSource | undefined {
    this._currentVectorSource = getVectorSourceFromLayer(
      id => this._host.getLayer(id),
      layerId,
      this._host.getModel(),
      storeId => this._host.getFeatureStoreOverlay(storeId),
    );

    return this._currentVectorSource;
  }

  private _isDrawLayerFilter(layer: Layer): boolean {
    return isDrawLayer(
      id => this._host.getLayer(id),
      this._currentDrawLayerId,
      layer,
    );
  }

  private _persist(source?: VectorSource, pendingFeature?: Feature): void {
    const map = this._host.getMap();
    const model = this._host.getModel();
    const vectorSource =
      source ??
      (this._currentDrawLayerId
        ? this._resolveVectorSource(this._currentDrawLayerId)
        : this._currentVectorSource);

    if (!this._currentDrawSourceId && this._currentDrawLayerId) {
      this._bindFromSelectedLayer();
    }

    if (
      !vectorSource ||
      !this._currentDrawSource ||
      !this._currentDrawSourceId ||
      !map
    ) {
      return;
    }

    // Feature-store overlays sync via Ydoc featureStores, not source data.
    if (this._currentDrawSource.type === 'FeatureStoreSource') {
      return;
    }

    const geojsonWriter = new GeoJSON({
      featureProjection: map.getView().getProjection(),
    });

    const liveFeatures = vectorSource.getFeatures();
    const featuresToSerialize =
      pendingFeature && !liveFeatures.includes(pendingFeature)
        ? [...liveFeatures, pendingFeature]
        : liveFeatures;

    const features = featuresToSerialize.map(feature =>
      geojsonWriter.writeFeatureObject(feature),
    );

    const updatedJgisSource: IJGISSource = {
      name: this._currentDrawSource.name,
      type: this._currentDrawSource.type,
      parameters: {
        data: {
          type: 'FeatureCollection',
          features,
        },
      },
    };

    this._currentDrawSource = updatedJgisSource;
    model.sharedModel.updateSource(
      this._currentDrawSourceId,
      updatedJgisSource,
    );
  }

  private _removeInteractions(): void {
    const map = this._host.getMap();
    if (!map) {
      return;
    }

    if (this._draw) {
      this._draw.setActive(false);
      map.removeInteraction(this._draw);
      this._draw = undefined;
    }

    if (this._modify) {
      this._modify.setActive(false);
      map.removeInteraction(this._modify);
      this._modify = undefined;
      this._host.setModifyHighlight([]);
    }

    if (this._deleteClick) {
      this._deleteClick.setActive(false);
      map.removeInteraction(this._deleteClick);
      this._deleteClick = undefined;
    }

    if (this._snap) {
      this._snap.setActive(false);
      map.removeInteraction(this._snap);
      this._snap = undefined;
    }
  }

  private _updateInteractions(): void {
    if (this._currentDrawLayerId) {
      this._resolveVectorSource(this._currentDrawLayerId);
    }

    this._removeInteractions();

    const map = this._host.getMap();
    if (!map || !this._currentVectorSource) {
      return;
    }

    const drawSource = this._currentVectorSource;

    if (this._deleting) {
      this._deleteClick = new Interaction({
        handleEvent: event => {
          if (!singleClick(event)) {
            return true;
          }

          this.deleteAtCoordinate(event.coordinate);
          return false;
        },
      });

      map.addInteraction(this._deleteClick);
      return;
    }

    this._modify = new Modify({ source: drawSource });
    this._modify.on('modifystart', (event: ModifyEvent) => {
      if (this._draw) {
        this._draw.setActive(false);
      }

      const highlights: Feature[] = [];
      event.features.forEach(feature => {
        const geometry = feature.getGeometry();
        if (geometry) {
          // Share the geometry so the highlight follows the drag.
          highlights.push(new Feature({ geometry }));
        }
      });
      this._host.setModifyHighlight(highlights);
    });

    this._modify.on('modifyend', () => {
      this._host.setModifyHighlight([]);
      if (this._draw) {
        this._draw.setActive(true);
      }
      this._persist();
    });

    this._snap = new Snap({ source: drawSource });

    map.addInteraction(this._modify);
    map.addInteraction(this._snap);

    if (this._currentDrawGeometry) {
      this._draw = new Draw({
        style: drawInteractionStyle,
        type: this._currentDrawGeometry,
        source: drawSource,
        // Only draw on left click
        condition: primaryAction,
      });
      this._draw.on('drawend', this._handleDrawEnd);
      map.addInteraction(this._draw);
      this._draw.setActive(true);
    }

    this._modify.setActive(true);
    this._snap.setActive(true);
  }

  private _handleDrawEnd = (event: DrawEvent): void => {
    const model = this._host.getModel();
    const feature = event.feature;
    const featureId = UUID.uuid4();
    feature.setId(featureId);
    feature.set('_id', featureId);
    feature.set('_createdAt', new Date().toISOString());
    feature.set('_creatorClientId', model.getClientId().toString());
    feature.set('_fromDrawTool', true);

    const layerId = this._currentDrawLayerId;
    const customAttributes = layerId
      ? model.getDrawCustomAttributes(layerId)
      : [];
    applyDrawCustomAttributesToFeature(feature, customAttributes);

    if (this._currentDrawSource?.type === 'FeatureStoreSource') {
      this._addFeatureStoreFeature(feature, featureId, customAttributes);
      return;
    }

    const source = layerId
      ? this._resolveVectorSource(layerId)
      : this._currentVectorSource;
    const onSource = source?.getFeatures().includes(feature) ?? false;

    // OL dispatches drawend before adding the feature to the source.
    this._persist(source, onSource ? undefined : feature);
  };

  private _addFeatureStoreFeature(
    feature: Feature,
    featureId: string,
    customAttributes: IDrawCustomAttribute[],
  ): void {
    const map = this._host.getMap();
    const model = this._host.getModel();
    const storeId = (
      this._currentDrawSource?.parameters as IFeatureStoreSource | undefined
    )?.storeId;

    if (!storeId || !map) {
      return;
    }

    const geometry = feature.getGeometry();
    if (!geometry) {
      return;
    }

    const geojsonGeometry = new GeoJSON().writeGeometryObject(geometry, {
      featureProjection: map.getView().getProjection(),
      dataProjection: 'EPSG:4326',
    }) as IFeatureStoreGeometry;

    const props = Object.fromEntries(
      customAttributes.map(attribute => [attribute.key, attribute.value]),
    );

    const result = model.addFeatureStoreFeature({
      storeId,
      id: featureId,
      geometry: geojsonGeometry,
      props,
    });

    // Drop the temporary OL feature; store sync re-adds from Ydoc.
    this._currentVectorSource?.removeFeature(feature);

    if (!result.ok) {
      const messages: Record<string, string> = {
        compacting: 'Cannot add features while folding into baseline.',
        missingStore: 'Feature store overlay is missing for this layer.',
        hardLimit:
          'Overlay hard limit reached. Fold edits into the baseline before adding more.',
      };
      void showErrorMessage(
        'Feature store',
        messages[result.reason] ?? messages.hardLimit,
      );
      return;
    }

    if (result.nearSoftLimit) {
      this._host.log(
        'warning',
        'Feature store overlay is near its soft limit; fold soon.',
      );
    }
  }
}

function overlayFeatureId(feature: Feature): string | undefined {
  const id = feature.get('_id') ?? feature.getId();
  return typeof id === 'string' && id ? id : undefined;
}

function baselineFeatureId(feature: RenderFeature): string | undefined {
  const raw = feature.get('id') ?? feature.get('_id');
  if (typeof raw === 'string' && raw) {
    return raw;
  }
  if (typeof raw === 'number') {
    return String(raw);
  }
  return undefined;
}
