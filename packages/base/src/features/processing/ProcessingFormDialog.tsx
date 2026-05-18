import { ProcessingType, IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import * as React from 'react';

import type { IBaseFormProps } from '@/src/types';
import { DissolveForm } from './forms/dissolveProcessForm';
import { DefaultProcessingForm } from './forms/processingForm';
import { RasterizeForm } from './forms/rasterizeForm';

export interface IProcessingFormDialogOptions extends IBaseFormProps {
  formContext: 'update' | 'create';
  schema: IDict;
  sourceData: IDict;
  title: string;
  syncData: (props: IDict) => void;
  syncSelectedPropField?: (
    id: string | null,
    value: any,
    parentType: 'dialog' | 'panel',
  ) => void;
  model: IJupyterGISModel;
  processingType: 'Export' | ProcessingType;
}

/**
 * Wrapper component to handle OK button state
 */
export interface IProcessingFormWrapperProps extends IProcessingFormDialogOptions {
  okSignalPromise: PromiseDelegate<Signal<Dialog<any>, number>>;
  formErrorSignalPromise?: PromiseDelegate<Signal<Dialog<any>, boolean>>;
}

const ProcessingFormWrapper: React.FC<IProcessingFormWrapperProps> = props => {
  const [ready, setReady] = React.useState<boolean>(false);

  const okSignal = React.useRef<Signal<Dialog<any>, number>>();
  const formErrorSignal = React.useRef<Signal<Dialog<any>, boolean>>();

  Promise.all([
    props.okSignalPromise.promise,
    props.formErrorSignalPromise?.promise,
  ]).then(([ok, formChanged]) => {
    okSignal.current = ok;
    formErrorSignal.current = formChanged || undefined;
    setReady(true);
  });

  let FormComponent: React.ComponentType<any>;
  switch (props.processingType) {
    case 'Dissolve':
      FormComponent = DissolveForm;
      break;
    case 'Rasterize':
      FormComponent = RasterizeForm;
      break;
    default:
      FormComponent = DefaultProcessingForm;
  }

  return (
    ready && (
      <FormComponent
        formContext={props.formContext}
        filePath={props.model.filePath}
        model={props.model}
        ok={okSignal.current}
        sourceData={props.sourceData}
        schema={props.schema}
        syncData={props.syncData}
      />
    )
  );
};

/**
 * Dialog for processing operations
 */
export class ProcessingFormDialog extends Dialog<IDict> {
  constructor(options: IProcessingFormDialogOptions) {
    // Extract layers from the shared model
    const layers = options.model.sharedModel.layers ?? {};
    const layerOptions = Object.keys(layers).map(layerId => ({
      value: layerId,
      label: layers[layerId].name,
    }));

    const vectorLayerOptions = Object.keys(layers)
      .filter(layerId => layers[layerId].type === 'VectorLayer')
      .map(layerId => ({ value: layerId, label: layers[layerId].name }));

    // Modify schema to include layer options and layer name field
    if (options.schema) {
      if (options.schema.properties?.inputLayer) {
        options.schema.properties.inputLayer.enum = layerOptions.map(
          option => option.value,
        );
        options.schema.properties.inputLayer.enumNames = layerOptions.map(
          option => option.label,
        );
      }

      if (options.schema.properties?.clipLayer) {
        const selectedInputLayer = options.sourceData?.inputLayer;
        const clipLayerOptions = selectedInputLayer
          ? vectorLayerOptions.filter(o => o.value !== selectedInputLayer)
          : vectorLayerOptions;
        options.schema.properties.clipLayer.enum = clipLayerOptions.map(
          option => option.value,
        );
        options.schema.properties.clipLayer.enumNames = clipLayerOptions.map(
          option => option.label,
        );
      }

      // Ensure outputLayerName field exists in schema
      if (!options.schema.properties?.outputLayerName) {
        options.schema.properties.outputLayerName = {
          type: 'string',
          title: 'Output Layer Name',
        };
      }
    }

    const filePath = options.model.filePath;
    const jgisModel = options.model;

    const okSignalPromise = new PromiseDelegate<
      Signal<Dialog<IDict>, number>
    >();
    const formErrorSignalPromise = new PromiseDelegate<
      Signal<Dialog<IDict>, boolean>
    >();

    const syncData = (props: IDict) => {
      options.syncData(props);
    };

    const body = (
      <div style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <ProcessingFormWrapper
          {...options}
          filePath={filePath}
          model={jgisModel}
          okSignalPromise={okSignalPromise}
          formErrorSignalPromise={formErrorSignalPromise}
          syncData={syncData} // Use the modified sync function
        />
      </div>
    );

    super({
      title: options.title,
      body,
      buttons: [Dialog.cancelButton(), Dialog.okButton()],
    });

    this.okSignal = new Signal(this);
    const formErrorSignal = new Signal<Dialog<any>, boolean>(this);

    /**
     * Disable the OK button if the form is invalid.
     */
    formErrorSignal.connect((_, extraErrors) => {
      const invalid = extraErrors || !!this.node.querySelector(':invalid');
      if (invalid) {
        this.node
          .getElementsByClassName('jp-mod-accept')[0]
          .setAttribute('disabled', '');
      } else {
        this.node
          .getElementsByClassName('jp-mod-accept')[0]
          .removeAttribute('disabled');
      }
    });

    okSignalPromise.resolve(this.okSignal);
    formErrorSignalPromise.resolve(formErrorSignal);

    this.addClass('jGIS-processing-FormDialog');
  }

  resolve(index?: number): void {
    if (index === 0) {
      super.resolve(index);
    }

    if (index === 1) {
      this.okSignal.emit(1);
    }
  }

  private okSignal: Signal<Dialog<IDict>, number>;
}
