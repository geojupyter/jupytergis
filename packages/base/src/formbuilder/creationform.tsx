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
import { PromiseDelegate, UUID } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import * as React from 'react';

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
}

/**
 * Form for creating a source, a layer or both at the same time
 */
export class CreationForm extends React.Component<ICreationFormProps, any> {
  constructor(props: ICreationFormProps) {
    super(props);

    this.filePath = props.model.filePath;
    this.jGISModel = props.model;
  }

  render() {
    const sourceId = UUID.uuid4();
    let layerSchema: IDict | undefined = undefined;
    const LayerForm = getLayerTypeForm(this.props.layerType || 'RasterLayer');
    const layerData = deepCopy(this.props.layerData || {});
    if (this.props.createLayer) {
      if (!this.props.layerType) {
        console.error('Cannot create a layer without specifying its type');
        return;
      }

      layerSchema = deepCopy(
        this.props.formSchemaRegistry.getSchemas().get(this.props.layerType),
      );

      if (!layerSchema) {
        console.error(`Cannot find schema for ${this.props.layerType}`);
        return;
      }

      // If a source is created as part of this form, remove the source selection from the layer form
      if (this.props.createSource) {
        delete layerSchema.properties?.source;
        layerData.source = sourceId;
      }
      layerSchema['required'] = ['name', ...layerSchema['required']];
      layerSchema['properties'] = {
        name: { type: 'string', description: 'The name of the layer' },
        ...layerSchema['properties'],
      };
    }

    let sourceSchema: IDict | undefined = undefined;
    const SourceForm = getSourceTypeForm(
      this.props.sourceType || 'RasterSource',
    );
    if (this.props.sourceType) {
      sourceSchema = deepCopy(
        this.props.formSchemaRegistry.getSchemas().get(this.props.sourceType),
      );

      if (!sourceSchema) {
        console.error(`Cannot find schema for ${this.props.sourceType}`);
        return;
      }

      if (!this.props.createLayer) {
        sourceSchema['required'] = ['name', ...sourceSchema['required']];
        sourceSchema['properties'] = {
          name: { type: 'string', description: 'The name of the source' },
          ...sourceSchema['properties'],
        };
      }
    }

    const creationPromises: Promise<IDict>[] = [];
    let layerCreationPromise: PromiseDelegate<IDict> | undefined;
    let sourceCreationPromise: PromiseDelegate<IDict> | undefined;
    if (this.props.createLayer) {
      layerCreationPromise = new PromiseDelegate<IDict>();
      creationPromises.push(layerCreationPromise.promise);
    }
    if (this.props.createSource) {
      sourceCreationPromise = new PromiseDelegate<IDict>();
      creationPromises.push(sourceCreationPromise.promise);
    }

    // Perform the layer/source creation
    Promise.all(creationPromises).then(async () => {
      // We add multiple tables from GeoPackage file as different sources and layers
      if (
        this.props.sourceType === 'GeoPackageVectorSource' ||
        this.props.sourceType === 'GeoPackageRasterSource'
      ) {
        const source = await sourceCreationPromise?.promise;

        if (!source) {
          console.error(`Cannot find source for ${this.props.sourceType}`);
          return;
        }

        const allTables = await getGeoPackageTableNames(
          source.path,
          this.props.sourceType,
        );

        let tableNames: string[];

        if (source.tables) {
          const requestedTableNames = source.tables
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);

          const invalidTableNames = requestedTableNames.filter(
            (name: string) => !allTables.includes(name),
          );
          if (invalidTableNames.length) {
            showErrorMessage(
              'Invalid GeoPackage Tables',
              `The following table${
                invalidTableNames.length > 1 ? 's are' : ' is'
              } not in the GeoPackage: ${invalidTableNames.join(', ')}. ` +
                `Available tables are: ${allTables.join(', ')}.`,
            );
          }

          tableNames = requestedTableNames.filter((name: string) =>
            allTables.includes(name),
          );

          if (tableNames.length === 0) {
            console.warn('No valid tables left to process, aborting.');
            return;
          }
        } else {
          tableNames = allTables;
        }

        for (const tableName of tableNames) {
          const childId = `${sourceId}/${tableName}`;

          if (this.props.createSource) {
            const sourceModel: IJGISSource = {
              type: this.props.sourceType,
              name: `${source.name} ${tableName} Source`,
              parameters: {
                path: source.path,
                tables: tableName,
                projection: source.projection || 'EPSG:3857',
              },
            };
            this.props.model.sharedModel.addSource(childId, sourceModel);
          }
          if (this.props.createLayer) {
            const layerModel: IJGISLayer = {
              type:
                this.props.layerType ||
                (this.props.sourceType === 'GeoPackageVectorSource'
                  ? 'VectorLayer'
                  : 'RasterLayer'),
              parameters: { source: childId },
              visible: true,
              name: `${source.name} ${tableName} Layer`,
            };
            this.jGISModel.addLayer(UUID.uuid4(), layerModel);
          }
        }
        return;
      }

      if (this.props.createSource) {
        let actualName = '';
        const { name, ...sourceData } =
          (await sourceCreationPromise?.promise) as IDict;

        actualName =
          name ||
          ((await layerCreationPromise?.promise) as IDict).name + ' Source';

        const sourceModel: IJGISSource = {
          type: this.props.sourceType || 'RasterSource',
          name: actualName,
          parameters: sourceData,
        };

        this.jGISModel.sharedModel.addSource(sourceId, sourceModel);
      }

      if (this.props.createLayer) {
        let actualName = '';

        const { name, ...layerData } =
          (await layerCreationPromise?.promise) as IDict;

        actualName =
          name ||
          ((await layerCreationPromise?.promise) as IDict).name + ' Layer';

        const layerModel: IJGISLayer = {
          type: this.props.layerType || 'RasterLayer',
          parameters: layerData,
          visible: true,
          name: actualName,
        };

        this.jGISModel.addLayer(UUID.uuid4(), layerModel);
      }
    });

    return (
      <div>
        {this.props.createSource && (
          <div>
            <h3>Source Properties</h3>
            <SourceForm
              formContext="create"
              model={this.jGISModel}
              filePath={this.filePath}
              schema={sourceSchema}
              sourceData={this.props.sourceData}
              syncData={(properties: { [key: string]: any }) => {
                sourceCreationPromise?.resolve(properties);
              }}
              ok={this.props.ok}
              cancel={this.props.cancel}
              formChangedSignal={this.sourceFormChangedSignal}
              formErrorSignal={this.props.formErrorSignal}
              dialogOptions={this.props.dialogOptions}
              sourceType={this.props.sourceType}
            />
          </div>
        )}
        {this.props.createLayer && (
          <div>
            <h3>Layer Properties</h3>
            <LayerForm
              formContext="create"
              sourceType={this.props.sourceType}
              model={this.jGISModel}
              filePath={this.filePath}
              schema={layerSchema}
              sourceData={layerData}
              syncData={(properties: { [key: string]: any }) => {
                layerCreationPromise?.resolve(properties);
              }}
              ok={this.props.ok}
              cancel={this.props.cancel}
              sourceFormChangedSignal={this.sourceFormChangedSignal}
              formErrorSignal={this.props.formErrorSignal}
              dialogOptions={this.props.dialogOptions}
            />
          </div>
        )}
      </div>
    );
  }

  private jGISModel: IJupyterGISModel;
  private filePath: string;
  private sourceFormChangedSignal: Signal<React.Component<any>, IDict<any>> =
    new Signal(this);
}
