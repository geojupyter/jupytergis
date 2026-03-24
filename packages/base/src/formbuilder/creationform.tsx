import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
  LayerType,
  SourceType,
} from '@jupytergis/schema';
import { Dialog, showErrorMessage } from '@jupyterlab/apputils';
import { UUID } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { useEffect, useMemo, useRef } from 'react';

import { deepCopy, getGeoPackageTableNames } from '@/src/';
import { getLayerTypeForm, getSourceTypeForm } from './formselectors';

export interface ICreationFormProps {
  /**
   * Whether or not to create a layer
   */
  createLayer: boolean;

  /**
   * Whether or not to create a source
   */
  createSource: boolean;

  /**
   * The type of layer to create.
   */
  layerType?: LayerType;

  /**
   * The type of source to create or to select in the case where we only create a layer.
   */
  sourceType: SourceType;

  /**
   * The initial layer data, if it applies.
   */
  layerData?: IDict;

  /**
   * The initial source data, if it applies.
   */
  sourceData?: IDict;

  /**
   * Ok signal. This is the signal sent by the parent dialog upon "Ok" button click. No ok button will be displayed if defined.
   */
  ok?: Signal<Dialog<any>, number>;

  /**
   * Cancel callback
   */
  cancel?: () => void;

  formSchemaRegistry: IJGISFormSchemaRegistry;
  model: IJupyterGISModel;

  /**
   * A signal emitting when the form changed, with a boolean whether there are some
   * extra errors or not.
   */
  formErrorSignal?: Signal<Dialog<any>, boolean>;

  /**
   * Configuration options for the dialog, including settings for layer data, source data,
   * and other form-related parameters.
   */
  dialogOptions?: any;

  /**
   * When provided (e.g. by LayerCreationFormDialog), the form registers a handler
   * that the dialog invokes on OK; the handler reads stored form data and runs
   * addSource/addLayer. No ok signal is passed to the inner forms when using this path.
   */
  registerConfirmHandler?: (fn: () => void) => void;
}

/**
 * Form for creating a source, a layer or both at the same time
 */
export function CreationForm(props: ICreationFormProps) {
  const {
    createLayer,
    createSource,
    layerType,
    sourceType,
    layerData: initialLayerData,
    sourceData: initialSourceData,
    formSchemaRegistry,
    model,
    cancel,
    formErrorSignal,
    dialogOptions,
    registerConfirmHandler,
  } = props;

  const filePath = model.filePath;

  const sourceFormChangedSignalRef = useRef<Signal<object, IDict<any>> | null>(
    null,
  );

  if (!sourceFormChangedSignalRef.current) {
    sourceFormChangedSignalRef.current = new Signal<object, IDict<any>>({});
  }

  const sourceFormChangedSignal = sourceFormChangedSignalRef.current;
  const sourceIdRef = useRef(UUID.uuid4());
  const sourceId = sourceIdRef.current;
  const sourceFormDataRef = useRef<IDict | null>(null);
  const layerFormDataRef = useRef<IDict | null>(null);

  const initialSourceForRef = useMemo(
    () => deepCopy(initialSourceData ?? {}),
    [initialSourceData],
  );

  const initialLayerForRef = useMemo(() => {
    const data = deepCopy(initialLayerData || {});
    if (createSource) {
      data.source = sourceId;
    }

    return data;
  }, [initialLayerData, createSource, sourceId]);

  if (sourceFormDataRef.current === null && createSource) {
    sourceFormDataRef.current = initialSourceForRef;
  }

  if (layerFormDataRef.current === null && createLayer) {
    layerFormDataRef.current = initialLayerForRef;
  }

  const modelRef = useRef(model);
  const createLayerRef = useRef(createLayer);
  const createSourceRef = useRef(createSource);
  const sourceTypeRef = useRef(sourceType);
  const layerTypeRef = useRef(layerType);

  modelRef.current = model;
  createLayerRef.current = createLayer;
  createSourceRef.current = createSource;
  sourceTypeRef.current = sourceType;
  layerTypeRef.current = layerType;

  useEffect(() => {
    if (!registerConfirmHandler) {
      return;
    }

    registerConfirmHandler(() => {
      const currentModel = modelRef.current;
      const currentCreateSource = createSourceRef.current;
      const currentCreateLayer = createLayerRef.current;
      const currentSourceType = sourceTypeRef.current;
      const currentLayerType = layerTypeRef.current;
      const currentSourceId = sourceIdRef.current;

      const sourceData = sourceFormDataRef.current ?? {};
      const layerData = layerFormDataRef.current ?? {};

      // GeoPackage handling
      if (
        currentSourceType === 'GeoPackageVectorSource' ||
        currentSourceType === 'GeoPackageRasterSource'
      ) {
        (async () => {
          if (!currentCreateSource) {
            console.error('GeoPackage handling requires source creation');
            return;
          }

          const { name: sourceName, ...sourceParams } = sourceData;

          const allTables = await getGeoPackageTableNames(
            sourceParams.path,
            currentSourceType,
          );

          let tableNames: string[];

          if (sourceParams.tables) {
            const requested = sourceParams.tables
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);

            const invalid = requested.filter(
              (t: string) => !allTables.includes(t),
            );

            if (invalid.length) {
              showErrorMessage(
                'Invalid GeoPackage Tables',
                `Invalid: ${invalid.join(', ')}. Available: ${allTables.join(', ')}`,
              );
            }

            tableNames = requested.filter((t: string) =>
              allTables.includes(t),
            );

            if (!tableNames.length) {
              console.warn('No valid tables. Aborting.');
              return;
            }
          } else {
            tableNames = allTables;
          }

          for (const tableName of tableNames) {
            const childId = `${currentSourceId}/${tableName}`;

            if (currentCreateSource) {
              const sourceModel: IJGISSource = {
                type: currentSourceType,
                name: `${sourceName ?? 'Source'} ${tableName} Source`,
                parameters: {
                  ...sourceParams,
                  tables: tableName,
                },
              };

              currentModel.sharedModel.addSource(childId, sourceModel);
            }

            if (currentCreateLayer) {
              const layerModel: IJGISLayer = {
                type:
                  currentLayerType ||
                  (currentSourceType === 'GeoPackageVectorSource'
                    ? 'VectorLayer'
                    : 'RasterLayer'),
                parameters: { source: childId },
                visible: true,
                name: `${sourceName ?? 'Layer'} ${tableName} Layer`,
              };

              currentModel.addLayer(UUID.uuid4(), layerModel);
            }
          }
        })();

        return;
      }

      // Normal flow
      if (currentCreateSource) {
        const { name, ...sourceParams } = sourceData;

        const actualName =
          name ||
          (currentCreateLayer && layerData?.name
            ? `${layerData.name} Source`
            : '');

        const sourceModel: IJGISSource = {
          type: currentSourceType || 'RasterSource',
          name: actualName,
          parameters: sourceParams,
        };

        currentModel.sharedModel.addSource(currentSourceId, sourceModel);
      }

      if (currentCreateLayer) {
        const { name, ...layerParams } = layerData;

        const actualName = name || `${layerData.name ?? 'Layer'} Layer`;

        const layerModel: IJGISLayer = {
          type: currentLayerType || 'RasterLayer',
          parameters: layerParams,
          visible: true,
          name: actualName,
        };

        currentModel.addLayer(UUID.uuid4(), layerModel);
      }
    });
  }, [registerConfirmHandler]);

  const LayerForm = useMemo(
    () => getLayerTypeForm(layerType || 'RasterLayer'),
    [layerType],
  );

  const SourceForm = useMemo(
    () => getSourceTypeForm(sourceType || 'RasterSource'),
    [sourceType],
  );

  const layerSchema = useMemo((): IDict | undefined => {
    if (!createLayer || !layerType) {
      return undefined;
    }

    const raw = formSchemaRegistry.getSchemas().get(layerType);
    if (!raw) {
      return undefined;
    }

    const schema = deepCopy(raw);

    if (createSource) {
      delete schema.properties?.source;
    }

    schema['required'] = ['name', ...(schema['required'] ?? [])];
    schema['properties'] = {
      name: { type: 'string', description: 'The name of the layer' },
      ...schema['properties'],
    };

    return schema;
  }, [createLayer, layerType, createSource, formSchemaRegistry]);

  const layerData = useMemo(() => {
    const data = deepCopy(initialLayerData || {});
    if (createSource) {
      data.source = sourceId;
    }
    return data;
  }, [initialLayerData, createSource, sourceId]);

  const sourceSchema = useMemo((): IDict | undefined => {
    if (!sourceType) {
      return undefined;
    }

    const raw = formSchemaRegistry.getSchemas().get(sourceType);
    if (!raw) {
      return undefined;
    }

    const schema = deepCopy(raw);

    if (!createLayer) {
      schema['required'] = ['name', ...(schema['required'] ?? [])];
      schema['properties'] = {
        name: { type: 'string', description: 'The name of the source' },
        ...schema['properties'],
      };
    }

    return schema;
  }, [sourceType, createLayer, formSchemaRegistry]);

  if (createLayer && !layerType) {
    console.error('Cannot create a layer without specifying its type');
    return null;
  }

  if (createLayer && !layerSchema) {
    console.error(`Cannot find schema for ${layerType}`);
    return null;
  }

  if (sourceType && !sourceSchema) {
    console.error(`Cannot find schema for ${sourceType}`);
    return null;
  }

  return (
    <div>
      {createSource && sourceSchema && (
        <div>
          <h3>Source Properties</h3>
          <SourceForm
            formContext="create"
            model={model}
            filePath={filePath}
            schema={sourceSchema}
            sourceData={initialSourceData}
            syncData={(properties: IDict) => {
              sourceFormDataRef.current = properties;
            }}
            cancel={cancel}
            formChangedSignal={sourceFormChangedSignal}
            formErrorSignal={formErrorSignal}
            dialogOptions={dialogOptions}
            sourceType={sourceType}
            formSchemaRegistry={formSchemaRegistry}
          />
        </div>
      )}

      {createLayer && layerSchema && (
        <div>
          <h3>Layer Properties</h3>
          <LayerForm
            formContext="create"
            sourceType={sourceType}
            model={model}
            filePath={filePath}
            schema={layerSchema}
            sourceData={layerData}
            syncData={(properties: IDict) => {
              layerFormDataRef.current = properties;
            }}
            cancel={cancel}
            sourceFormChangedSignal={sourceFormChangedSignal}
            formErrorSignal={formErrorSignal}
            dialogOptions={dialogOptions}
            formSchemaRegistry={formSchemaRegistry}
          />
        </div>
      )}
    </div>
  );
}
