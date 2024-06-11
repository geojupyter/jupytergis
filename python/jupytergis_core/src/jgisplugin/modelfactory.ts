import {
  IAnnotationModel,
  IJupyterCadDoc,
  JupyterCadModel
} from '@jupytergis/schema';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Contents } from '@jupyterlab/services';

/**
 * A Model factory to create new instances of JupyterCadModel.
 */
export class JupyterCadJcadModelFactory
  implements DocumentRegistry.IModelFactory<JupyterCadModel>
{
  constructor(options: JupyterCadJcadModelFactory.IOptions) {
    this._annotationModel = options.annotationModel;
  }

  /**
   * Whether the model is collaborative or not.
   */
  readonly collaborative = true;

  /**
   * The name of the model.
   *
   * @returns The name
   */
  get name(): string {
    return 'jupytercad-jcadmodel';
  }

  /**
   * The content type of the file.
   *
   * @returns The content type
   */
  get contentType(): Contents.ContentType {
    return 'jcad';
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
   * Create a new instance of JupyterCadModel.
   *
   * @returns The model
   */
  createNew(
    options: DocumentRegistry.IModelOptions<IJupyterCadDoc>
  ): JupyterCadModel {
    const model = new JupyterCadModel({
      sharedModel: options.sharedModel,
      languagePreference: options.languagePreference,
      annotationModel: this._annotationModel
    });
    return model;
  }

  private _annotationModel: IAnnotationModel;
  private _disposed = false;
}

export namespace JupyterCadJcadModelFactory {
  export interface IOptions {
    annotationModel: IAnnotationModel;
  }
}
