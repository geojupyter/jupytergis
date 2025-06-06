import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import * as React from 'react';

import {
  BaseForm,
  IBaseFormProps,
} from '@/src/formbuilder/objectform/baseform';
import { DissolveForm } from '@/src/formbuilder/objectform/process';

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
  processingType: 'Buffer' | 'Dissolve' | 'Export' | 'Reproject';
}

/**
 * Wrapper component to handle OK button state
 */
export interface IProcessingFormWrapperProps
  extends IProcessingFormDialogOptions {
  okSignalPromise: PromiseDelegate<Signal<Dialog<any>, number>>;
  formErrorSignalPromise?: PromiseDelegate<Signal<Dialog<any>, boolean>>;
}

const ProcessingFormWrapper = (props: IProcessingFormWrapperProps) => {
  const [ready, setReady] = React.useState<boolean>(false);

  const okSignal = React.useRef<Signal<Dialog<any>, number>>();
  const formErrorSignal = React.useRef<Signal<Dialog<any>, boolean>>();

  Promise.all([
    props.okSignalPromise.promise,
    props.formErrorSignalPromise?.promise,
  ]).then(([ok, formChanged]) => {
    okSignal.current = ok;
    formErrorSignal.current = formChanged;
    setReady(true);
  });

  let FormComponent;
  switch (props.processingType) {
    case 'Dissolve':
      FormComponent = DissolveForm;
      break;
    case 'Buffer':
    case 'Export':
    case 'Reproject':
    default:
      FormComponent = BaseForm;
  }

  return (
    ready && (
      <FormComponent
        formContext={props.formContext}
        filePath={props.model.filePath}
        model={props.model}
        ok={okSignal.current}
        cancel={props.cancel}
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

      // Ensure outputLayerName field exists in schema
      if (!options.schema.properties?.outputLayerName) {
        options.schema.properties.outputLayerName = {
          type: 'string',
          title: 'outputLayerName',
          // default: ''
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

    // Custom syncData function to update layer name in the model
    const syncData = (props: IDict) => {
      if (
        props.outputLayerName &&
        props.inputLayer &&
        layers[props.inputLayer]
      ) {
        layers[props.inputLayer].name = props.outputLayerName;
      }
      options.syncData(props);
    };

    const body = (
      <div style={{ overflow: 'hidden' }}>
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

  private okSignal: Signal<Dialog<any>, number>;
}
