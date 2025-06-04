import {
  IJupyterGISDoc,
  JupyterGISModel,
  IAnnotationModel,
} from '@jupytergis/schema';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Contents } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

/**
 * A Model factory to create new instances of JupyterGISModel.
 */
export class JupyterGISModelFactoryBase
  implements DocumentRegistry.IModelFactory<JupyterGISModel>
{
  constructor(options: JupyterGISModelFactoryBase.IOptions) {
    this._annotationModel = options.annotationModel;
  }

  /**
   * Whether the model is collaborative or not.
   */
  readonly collaborative =
    document.querySelectorAll('[data-jupyter-lite-root]')[0] === undefined;

  /**
   * The name of the model.
   *
   * @returns The name
   */
  get name(): string {
    throw 'Not implemented';
  }

  /**
   * The content type of the file.
   *
   * @returns The content type
   */
  get contentType(): Contents.ContentType {
    throw 'Not implemented';
  }

  /**
   * The format of the file.
   *
   * @returns the file format
   */
  get fileFormat(): Contents.FileFormat {
    return 'base64';
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
   * Create a new instance of JupyterGISModel.
   *
   * @returns The model
   */
  createNew(
    options: DocumentRegistry.IModelOptions<IJupyterGISDoc>,
  ): JupyterGISModel {
    const model = new JupyterGISModel({
      sharedModel: options.sharedModel,
      languagePreference: options.languagePreference,
      annotationModel: this._annotationModel,
      settingRegistry: this._settingRegistry,
    });
    return model;
  }

  private _annotationModel: IAnnotationModel;
  private _settingRegistry: ISettingRegistry;
  private _disposed = false;
}

export namespace JupyterGISModelFactoryBase {
  export interface IOptions {
    annotationModel: IAnnotationModel;
    settingRegistry: ISettingRegistry;
  }
}

export class QGZModelFactory extends JupyterGISModelFactoryBase {
  /**
   * The name of the model.
   *
   * @returns The name
   */
  get name(): string {
    return 'jupytergis-qgzmodel';
  }

  /**
   * The content type of the file.
   *
   * @returns The content type
   */
  get contentType(): Contents.ContentType {
    return 'QGZ';
  }
}

export class QGSModelFactory extends JupyterGISModelFactoryBase {
  /**
   * The name of the model.
   *
   * @returns The name
   */
  get name(): string {
    return 'jupytergis-qgsmodel';
  }

  /**
   * The content type of the file.
   *
   * @returns The content type
   */
  get contentType(): Contents.ContentType {
    return 'QGS';
  }
}
