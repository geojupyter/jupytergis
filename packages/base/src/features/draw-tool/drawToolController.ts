import type { IJupyterGISModel, IJGISSource } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import type { Map as OlMap } from 'ol';
import Feature from 'ol/Feature';
import { Coordinate } from 'ol/coordinate';
import { GeoJSON } from 'ol/format';
import { Type } from 'ol/geom/Geometry';
import Draw, { DrawEvent } from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import { Layer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';

import { applyDrawCustomAttributesToFeature } from '@/src/features/labels/drawCustomAttributes';
import { drawInteractionStyle } from './drawInteractionStyle';
import { getVectorSourceFromLayer, isDrawLayer } from './drawToolUtils';

export interface IDrawToolHost {
  getMap(): OlMap | undefined;
  getLayer(layerId: string): Layer | undefined;
  getModel(): IJupyterGISModel;
  onDrawLayerIdChange(layerId: string | undefined): void;
  onDrawGeometryLabelChange(label: string): void;
}

export class DrawToolController {
  private _draw: Draw | undefined;
  private _snap: Snap | undefined;
  private _modify: Modify | undefined;
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

  enterLayer(): void {
    this._bindFromSelectedLayer();
    if (!this._currentDrawLayerId) {
      return;
    }

    this._updateInteractions();
  }

  leaveDrawMode(): void {
    this._removeInteractions();
    this._currentDrawGeometry = undefined;
    this._currentDrawLayerId = undefined;
    this._host.onDrawLayerIdChange(undefined);
    this._host.onDrawGeometryLabelChange('');
  }

  removeInteractions(): void {
    this._removeInteractions();
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

    for (const hit of hits) {
      if (!(hit instanceof Feature)) {
        continue;
      }

      const featureId = hit.get('_id');
      const onSource =
        featureId !== undefined
          ? source.getFeatures().find(f => f.get('_id') === featureId)
          : hit;

      if (onSource) {
        source.removeFeature(onSource);
      } else {
        source.removeFeature(hit);
      }
    }

    this._currentVectorSource = source;
    this._persist(source);

    return true;
  }

  hasFeatureAtCoordinate(coordinate: Coordinate): boolean {
    const map = this._host.getMap();
    if (!this._currentVectorSource || !map) {
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

    this._modify = new Modify({ source: drawSource });
    this._modify.on('modifystart', () => {
      if (this._draw) {
        this._draw.setActive(false);
      }
    });

    this._modify.on('modifyend', () => {
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
    feature.set('_id', UUID.uuid4());
    feature.set('_createdAt', new Date().toISOString());
    feature.set('_creatorClientId', model.getClientId().toString());
    feature.set('_fromDrawTool', true);

    const layerId = this._currentDrawLayerId;
    const customAttributes = layerId
      ? model.getDrawCustomAttributes(layerId)
      : [];
    applyDrawCustomAttributesToFeature(feature, customAttributes);

    const source = layerId
      ? this._resolveVectorSource(layerId)
      : this._currentVectorSource;
    const onSource = source?.getFeatures().includes(feature) ?? false;

    // OL dispatches drawend before adding the feature to the source.
    this._persist(source, onSource ? undefined : feature);
  };
}
