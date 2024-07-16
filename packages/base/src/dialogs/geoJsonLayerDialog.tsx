import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel
} from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { UUID } from '@lumino/coreutils';
import * as React from 'react';

import { GeoJSONLayerPropertiesForm } from '../formbuilder';
import { deepCopy } from '../tools';

/**
 * Properties for the component to create GeoJSON layer.
 */
export interface IGeoJSONLayerComponentProps {
  model: IJupyterGISModel;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  cancel: () => void;
}

/**
 * React component returning a form dedicated to GeoJSON layer (and source) creation.
 */
export const GeoJSONLayerComponent = ({
  model,
  formSchemaRegistry,
  cancel
}: IGeoJSONLayerComponentProps) => {
  const schema = deepCopy(formSchemaRegistry.getSchemas().get('VectorLayer'));
  if (!schema) {
    return;
  }

  delete schema.properties?.source;
  schema['properties'] = {
    name: { type: 'string', description: 'The name of the vector layer' },
    path: { type: 'string', description: 'The path to the GeoJSON file' },
    ...schema['properties']
  };

  schema.required = ['name', 'path'];

  const syncData = (props: IDict) => {
    const sharedModel = model.sharedModel;
    if (!sharedModel) {
      return;
    }
    const { name, path, ...parameters } = props;
    const sourceId = UUID.uuid4();

    const sourceName = PathExt.basename(path, '.json');
    const sourceModel: IJGISSource = {
      type: 'GeoJSONSource',
      name: sourceName,
      parameters: {
        path
      }
    };

    const layerModel: IJGISLayer = {
      type: 'VectorLayer',
      parameters: {
        source: sourceId,
        type: parameters.type,
        color: parameters.color,
        opacity: parameters.opacity
      },
      visible: true,
      name: name
    };

    sharedModel.addSource(sourceId, sourceModel);
    model.addLayer(UUID.uuid4(), layerModel);
  };

  return (
    <GeoJSONLayerPropertiesForm
      formContext={'create'}
      model={model}
      schema={schema}
      sourceData={{
        name: 'Vector Layer'
      }}
      syncData={syncData}
      cancel={cancel}
    />
  );
};

/**
 * Options for the dialog to create GeoJSON layer.
 */
export interface IGeoJSONLayerOptions {
  model: IJupyterGISModel;
  registry: IJGISFormSchemaRegistry;
}

/**
 * The widget included in the Dialog shown when creating a GeoJSON layer (and source).
 */
export class GeoJSONLayerDialog extends Dialog<boolean> {
  constructor(options: IGeoJSONLayerOptions) {
    let cancelCallback: (() => void) | undefined = undefined;
    cancelCallback = () => {
      this.resolve(0);
    };

    const body = (
      <GeoJSONLayerComponent
        model={options.model}
        formSchemaRegistry={options.registry}
        cancel={cancelCallback}
      />
    );

    super({ body, buttons: [Dialog.cancelButton(), Dialog.okButton()] });

    this.addClass('jGIS-geoJSONLayer-FormDialog');
    this.id = 'jupytergis::geoJSONLayerDialog';
  }
}
