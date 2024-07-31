import { SchemaForm } from '@deathbeds/jupyterlab-rjsf';
import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { IChangeEvent, ISubmitEvent } from '@rjsf/core';
import * as React from 'react';

import { IDict } from '../../types';
import { IJupyterGISModel } from '@jupytergis/schema';
import { deepCopy } from '../../tools';
import { Signal } from '@lumino/signaling';
import { Dialog } from '@jupyterlab/apputils';

export interface IBaseFormStates {
  schema?: IDict;
  extraErrors?: any;
}

export interface IBaseFormProps {
  /**
   * The context of the form, whether it's for creating an object or updating its properties. This will have the effect of showing or not inputs for readonly properties.
   */
  formContext: 'update' | 'create';

  /**
   * The source data for filling the form
   */
  sourceData: IDict | undefined;

  /**
   * Path to the file
   */
  filePath?: string;

  /**
   * Current GIS model
   */
  model: IJupyterGISModel;

  /**
   * callback for syncing back the data into the model upon form submit
   * @param properties
   */
  syncData: (properties: IDict) => void;

  /**
   * The schema for the rjsf formk
   */
  schema?: IDict;

  /**
   * Ok signal. This is the signal sent by the parent dialog upon "Ok" button click. No ok button will be displayed if defined.
   */
  ok?: Signal<Dialog<any>, number>;

  /**
   * Cancel callback
   */
  cancel?: () => void;

  /**
   * A signal emitting when the form changed, with a boolean whether there are some
   * extra errors or not.
   */
  formChangedSignal?: Signal<Dialog<any>, boolean>;
}

// Reusing the datalayer/jupyter-react component:
// https://github.com/datalayer/jupyter-react/blob/main/packages/react/src/jupyter/lumino/Lumino.tsx
export const LuminoSchemaForm = (
  props: React.PropsWithChildren<any>
): JSX.Element => {
  const ref = React.useRef<HTMLDivElement>(null);
  const { children } = props;
  React.useEffect(() => {
    const widget = children as SchemaForm;
    try {
      MessageLoop.sendMessage(widget, Widget.Msg.BeforeAttach);
      ref.current!.insertBefore(widget.node, null);
      MessageLoop.sendMessage(widget, Widget.Msg.AfterAttach);
    } catch (e) {
      console.warn('Exception while attaching Lumino widget.', e);
    }
    return () => {
      try {
        if (widget.isAttached || widget.node.isConnected) {
          Widget.detach(widget);
        }
      } catch (e) {
        console.warn('Exception while detaching Lumino widget.', e);
      }
    };
  }, [children]);
  return <div ref={ref} />;
};

/**
 * Generate a form to edit a layer/source type. This class is meant to be sub-classed to create more refined forms for specific layers/sources.
 *
 * It will be up to the user of this class to actually perform the creation/edit using syncdata.
 */
export class BaseForm extends React.Component<IBaseFormProps, IBaseFormStates> {
  constructor(props: IBaseFormProps) {
    super(props);
    this.currentFormData = deepCopy(this.props.sourceData);
    this.state = {
      schema: props.schema,
      extraErrors: {}
    };
  }

  componentDidUpdate(
    prevProps: IBaseFormProps,
    prevState: IBaseFormStates
  ): void {
    if (prevProps.sourceData !== this.props.sourceData) {
      this.currentFormData = deepCopy(this.props.sourceData);
      const schema = deepCopy(this.props.schema);
      this.setState(old => ({ ...old, schema }));
    }
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ): void {
    if (!schema['properties']) {
      return;
    }

    Object.entries(schema['properties'] as IDict).forEach(([k, v]) => {
      uiSchema[k] = {};

      if (v['type'] === 'array') {
        // Remove array buttons
        uiSchema[k] = {
          'ui:options': {
            orderable: false,
            removable: false,
            addable: false
          },
          ...uiSchema[k]
        };

        if (v['items']['type'] === 'array') {
          uiSchema[k] = {
            items: {
              'ui:options': {
                orderable: false,
                removable: false,
                addable: false
              },
              ...uiSchema[k]['items']
            },

            ...uiSchema[k]
          };
        }
      }

      if (v['type'] === 'object') {
        this.processSchema(data, v, uiSchema[k]);
      }

      // Don't show readOnly properties when it's a form for updating an object
      if (v['readOnly']) {
        if (this.props.formContext === 'create') {
          delete v['readOnly'];
        }

        if (this.props.formContext === 'update') {
          this.removeFormEntry(k, data, schema, uiSchema);
        }
      }
    });
  }

  /**
   * Remove a specific entry from the form. Can be used in subclasses if needed while under processSchema.
   * @param entry The entry name
   * @param data The form data
   * @param schema The form schema
   * @param uiSchema The form uiSchema
   */
  protected removeFormEntry(
    entry: string,
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    if (data) {
      delete data[entry];
    }
    delete schema.properties[entry];
    delete uiSchema[entry];
    if (schema.required && schema.required.includes(entry)) {
      schema.required.splice(schema.required.indexOf(entry), 1);
    }
  }

  protected syncData(properties: IDict<any> | undefined) {
    if (!properties) {
      return;
    }

    this.props.syncData(properties);
  }

  protected onFormChange(e: IChangeEvent) {
    this.currentFormData = e.formData;

    // Emit the signal if defined.
    if (this.props.formChangedSignal) {
      const extraErrors = Object.keys(this.state.extraErrors).length > 0;
      this.props.formChangedSignal.emit(extraErrors);
    }
  }

  protected onFormBlur(id: string, value: any) {
    // This is a no-op here
  }

  protected onFormSubmit(e: ISubmitEvent<any>): void {
    this.currentFormData = e.formData;

    this.syncData(this.currentFormData);

    this.props.cancel && this.props.cancel();
  }

  render(): React.ReactNode {
    if (this.props.schema) {
      const schema = { ...this.state.schema, additionalProperties: true };
      const formData = this.currentFormData;

      const uiSchema = {
        additionalProperties: {
          'ui:label': false,
          classNames: 'jGIS-hidden-field'
        }
      };
      this.processSchema(formData, schema, uiSchema);

      const submitRef = React.createRef<HTMLButtonElement>();

      // When the parent "ok" button gets clicked, submit
      this.props.ok?.connect(() => {
        submitRef.current?.click();
      });

      const formSchema = new SchemaForm(schema, {
        liveValidate: true,
        formData,
        onChange: this.onFormChange.bind(this),
        onSubmit: this.onFormSubmit.bind(this),
        onBlur: this.onFormBlur.bind(this),
        uiSchema,
        children: (
          <button ref={submitRef} type="submit" style={{ display: 'none' }} />
        ),
        extraErrors: this.state.extraErrors
      });
      return (
        <div
          className="jGIS-property-panel"
          data-path={this.props.filePath ?? ''}
        >
          <div className="jGIS-property-outer">
            <LuminoSchemaForm>{formSchema}</LuminoSchemaForm>
          </div>

          {!this.props.ok && (
            <div className="jGIS-property-buttons">
              <button
                className="jp-Dialog-button jp-mod-accept jp-mod-styled"
                onClick={() => submitRef.current?.click()}
              >
                <div className="jp-Dialog-buttonLabel">Ok</div>
              </button>
            </div>
          )}
        </div>
      );
    }
  }

  protected currentFormData: IDict<any> | undefined;
}
