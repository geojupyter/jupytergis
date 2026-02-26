import {
  IDict,
  IJGISFormSchemaRegistry,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import type { IDocumentManager } from '@jupyterlab/docmanager';
import { FieldProps } from '@rjsf/core';
import * as React from 'react';

import { deepCopy } from '@/src/tools';
import { getSourceTypeForm } from '../../formselectors';
import type { ISourceFormProps } from '../source/sourceform';

// ! TODO extract this - also used in layerselect
function extractLayerOverrideIndex(idSchema: {
  $id?: string;
}): number | undefined {
  const id = idSchema?.$id ?? '';
  const match = id.match(/layerOverride_(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * RJSF custom field for layerOverride[].sourceProperties: renders the
 * appropriate source form for the target layer's source type.
 */
export function SourcePropertiesField(props: FieldProps): React.ReactElement {
  const context = props.formContext as
    | {
        docManager?: IDocumentManager;
        formData?: IStorySegmentLayer;
        formSchemaRegistry?: IJGISFormSchemaRegistry;
      }
    | undefined;
  const fullFormData = context?.formData;
  const formSchemaRegistry = context?.formSchemaRegistry;
  const docManager = context?.docManager;
  const index = extractLayerOverrideIndex(props.idSchema ?? {});
  const model = props.formContext?.model;
  const layerId = fullFormData?.layerOverride?.[index ?? 0]?.targetLayer;
  const layer = model?.getLayer(layerId);
  const sourceID = layer?.parameters?.source;
  const source = model?.getSource(sourceID);

  /* Use form value so edits persist; fall back to live source for initial display */
  const sourceProperties =
    (props.formData as IDict | undefined) ?? source?.parameters;

  const sourceSchema =
    source?.type && formSchemaRegistry
      ? deepCopy(formSchemaRegistry.getSchemas().get(source.type))
      : undefined;

  const SourceForm = getSourceTypeForm(source?.type ?? 'GeoJSONSource');

  const formProps: ISourceFormProps = {
    formContext: 'update',
    model: model,
    filePath: model?.filePath,
    schema: sourceSchema,
    sourceData: sourceProperties ?? undefined,
    syncData: (properties: IDict) => {
      props.onChange(properties);
    },
    sourceType: source?.type ?? 'GeoJSONSource',
    docManager,
  };
  return (
    <>
      <div id="jgis-source-properties-field">Source Parameters</div>
      <SourceForm {...formProps} />
    </>
  );
}
