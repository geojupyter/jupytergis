import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { Signal } from '@lumino/signaling';
import * as React from 'react';

import { deepCopy } from '@/src/tools';
import { getLayerTypeForm, getSourceTypeForm } from './formselectors';
import type { ILayerProps } from './objectform/layer/layerform';
import type { ISourceFormProps } from './objectform/source/sourceform';

export interface IEditFormProps {
  /**
   * The layer to edit
   */
  layer: string | undefined;

  /**
   * The source to edit
   */
  source: string | undefined;

  formSchemaRegistry: IJGISFormSchemaRegistry;
  model: IJupyterGISModel;
}

function syncObjectProperties(
  model: IJupyterGISModel,
  id: string | undefined,
  properties: IDict,
): void {
  if (!id) {
    return;
  }
  model.sharedModel.updateObjectParameters(id, properties);
}

/**
 * Form for editing a source, a layer or both at the same time
 */
export function EditForm(props: IEditFormProps): React.ReactElement | null {
  const { layer: layerId, source: sourceId, formSchemaRegistry, model } = props;

  const sourceFormChangedSignalRef = React.useRef<Signal<
    object,
    IDict<any>
  > | null>(null);
  if (!sourceFormChangedSignalRef.current) {
    sourceFormChangedSignalRef.current = new Signal<object, IDict<any>>({});
  }
  const sourceFormChangedSignal = sourceFormChangedSignalRef.current;

  let layer: IJGISLayer | undefined;
  let LayerForm: React.ComponentType<ILayerProps> | undefined;
  let layerData: IDict | undefined;
  let layerSchema: IDict | undefined;

  if (layerId) {
    layer = model.getLayer(layerId);
    if (!layer) {
      return null;
    }
    LayerForm = getLayerTypeForm(layer.type || 'RasterLayer');
    layerData = deepCopy(layer.parameters || {});
    layerSchema = deepCopy(formSchemaRegistry.getSchemas().get(layer.type));
    if (!layerSchema) {
      console.error(`Cannot find schema for ${layer.type}`);
      return null;
    }
  } else {
    layer = undefined;
    LayerForm = undefined;
    layerData = undefined;
    layerSchema = undefined;
  }

  let source: IJGISSource | undefined;
  let SourceForm: React.ComponentType<ISourceFormProps> | undefined;
  let sourceData: IDict | undefined;
  let sourceSchema: IDict | undefined;

  if (sourceId) {
    source = model.getSource(sourceId);

    if (!source) {
      return null;
    }

    SourceForm = getSourceTypeForm(source.type || 'RasterSource');
    sourceData = deepCopy(source.parameters || {});
    sourceSchema = deepCopy(formSchemaRegistry.getSchemas().get(source.type));

    if (!sourceSchema) {
      console.error(`Cannot find schema for ${source.type}`);

      return null;
    }
  } else {
    source = undefined;
    SourceForm = undefined;
    sourceData = undefined;
    sourceSchema = undefined;
  }

  return (
    <div>
      {layerId && LayerForm && layerSchema && layerData !== undefined && (
        <div>
          <h3 style={{ paddingLeft: '5px' }}>Layer Properties</h3>
          <LayerForm
            key={`${layerId}-${source?.type}`}
            formContext="update"
            sourceType={source?.type || 'RasterSource'}
            model={model}
            filePath={model.filePath}
            schema={layerSchema}
            sourceData={layerData}
            syncData={(properties: IDict) => {
              syncObjectProperties(model, layerId, properties);
            }}
            formSchemaRegistry={formSchemaRegistry}
          />
        </div>
      )}

      {sourceId && SourceForm && sourceSchema && sourceData !== undefined && (
        <div>
          <h3 style={{ paddingLeft: '5px' }}>Source Properties</h3>
          <SourceForm
            key={`${sourceId}-${layer?.type}`}
            formContext="update"
            model={model}
            filePath={model.filePath}
            schema={sourceSchema}
            sourceData={sourceData}
            syncData={(properties: IDict) => {
              syncObjectProperties(model, sourceId, properties);
            }}
            formChangedSignal={sourceFormChangedSignal}
            sourceType={source?.type || 'RasterSource'}
            formSchemaRegistry={formSchemaRegistry}
          />
        </div>
      )}
    </div>
  );
}
