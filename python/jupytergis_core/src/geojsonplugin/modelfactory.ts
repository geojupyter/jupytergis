import { IJupyterGISDoc, JupyterGISModel } from '@jupytergis/schema';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Contents } from '@jupyterlab/services';
import { JupyterGISGeoJSONDoc } from './model';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IAnnotationModel } from '@jupytergis/schema';

class JupyterGISGeoJSONModel extends JupyterGISModel {
  constructor(options: {
    sharedModel?: IJupyterGISDoc;
    languagePreference?: string;
    settingRegistry?: ISettingRegistry;
    annotationModel?: IAnnotationModel;
  }) {
    super({
      sharedModel: options.sharedModel,
      languagePreference: options.languagePreference,
      settingRegistry: options.settingRegistry,
      annotationModel: options.annotationModel
    });
  }

  fromString(data: string): void {
    (this.sharedModel as JupyterGISGeoJSONDoc).source = data;
    this.dirty = true;
  }

  protected createSharedModel(): IJupyterGISDoc {
    return JupyterGISGeoJSONDoc.create();
  }
}

/**
 * A Model factory to create new instances of JupyterGISGeoJSONModel.
 */
export class JupyterGISGeoJSONModelFactory
  implements DocumentRegistry.IModelFactory<JupyterGISGeoJSONModel>
{
  constructor(options: {
    settingRegistry?: ISettingRegistry;
    annotationModel?: IAnnotationModel;
  }) {
    this._settingRegistry = options.settingRegistry;
    this._annotationModel = options.annotationModel;
  }

  readonly collaborative = true;

  /**
   * The name of the model.
   *
   * @returns The name
   */
  get name(): string {
    return 'jupytergis-geojsonmodel';
  }

  /**
   * The content type of the file.
   *
   * @returns The content type
   */
  get contentType(): Contents.ContentType {
    return 'geojson';
  }

  /**
   * The format of the file.
   *
   * @returns the file format
   */
  get fileFormat(): Contents.FileFormat {
    return 'text';
  }

  /**
   * Get whether the model factory has been disposed.
   *
   * @returns disposed status
   */
  get isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Dispose the model factory.
   */
  dispose(): void {
    this._disposed = true;
  }

  /**
   * Get the preferred language given the path on the file.
   *
   * @param path path of the file represented by this document model
   * @returns The preferred language
   */
  preferredLanguage(path: string): string {
    return '';
  }

  /**
   * Create a new instance of JupyterGISGeoJSONModel.
   *
   * @returns The model
   */
  createNew(
    options: DocumentRegistry.IModelOptions<IJupyterGISDoc>
  ): JupyterGISGeoJSONModel {
    const model = new JupyterGISGeoJSONModel({
      sharedModel: options.sharedModel,
      languagePreference: options.languagePreference,
      settingRegistry: this._settingRegistry,
      annotationModel: this._annotationModel
    });
    model.initSettings();
    return model;
  }

  private _disposed = false;
  private _settingRegistry: ISettingRegistry | undefined;
  private _annotationModel: IAnnotationModel | undefined;
}
