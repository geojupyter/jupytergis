import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import type { IDocumentManager } from '@jupyterlab/docmanager';
import { FormComponent } from '@jupyterlab/ui-components';
import { Signal } from '@lumino/signaling';
import { IChangeEvent, ISubmitEvent } from '@rjsf/core';
import { RegistryFieldsType, RJSFSchema, UiSchema } from '@rjsf/utils';
import validatorAjv8 from '@rjsf/validator-ajv8';
import * as React from 'react';

import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';
import { LayerSelect } from './components/LayerSelect';
import OpacitySlider from './components/OpacitySlider';

export interface IJupyterGISFormContext<TFormData = IDict | undefined> {
  model: IJupyterGISModel;
  formData: TFormData;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
  docManager?: IDocumentManager;
}

export interface IBaseFormStates {
  schema?: RJSFSchema;
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
   * A signal emitting when the form changed
   */
  formChangedSignal?: Signal<any, IDict<any>>;

  /**
   * A signal emitting when the form has extra errors, with a boolean whether there are some
   * extra errors or not.
   */
  formErrorSignal?: Signal<Dialog<any>, boolean>;

  /**
   * Registry of form schemas for layers/sources; passed into formContext for custom fields.
   */
  formSchemaRegistry?: IJGISFormSchemaRegistry;

  /**
   * JupyterLab document manager (e.g. for file picker); available from formContext when using RJSF.
   */
  docManager?: IDocumentManager;
}

const WrappedFormComponent: React.FC<any> = props => {
  const { ...rest } = props;

  const fields: RegistryFieldsType = {
    opacity: OpacitySlider,
    layerSelect: LayerSelect,
  };

  return (
    <FormComponent
      {...rest}
      validator={validatorAjv8}
      fields={{
        ...fields,
      }}
    />
  );
};

/**
 * Generate a form to edit a layer/source type. This class is meant to be sub-classed to create more refined forms for specific layers/sources.
 *
 * It will be up to the user of this class to actually perform the creation/edit using syncdata.
 */
export class BaseForm extends React.Component<IBaseFormProps, IBaseFormStates> {
  /** Skip syncData for the initial onChange (RJSF populating form), only sync on user edits. */
  private isInitialLoadRef = true;

  constructor(props: IBaseFormProps) {
    super(props);
    this.currentFormData = deepCopy(this.props.sourceData);
    if (props.schema) {
      const applied = this.applySchemaDefaults(
        this.currentFormData,
        props.schema as RJSFSchema,
      );
      if (applied) {
        props.syncData(this.currentFormData ?? {});
      }
    }
    this.state = {
      schema: props.schema,
      extraErrors: {},
    };
  }

  componentDidUpdate(
    prevProps: IBaseFormProps,
    prevState: IBaseFormStates,
  ): void {
    if (prevProps.sourceData !== this.props.sourceData) {
      this.currentFormData = deepCopy(this.props.sourceData);
      const schema = deepCopy(this.props.schema);
      this.setState(old => ({ ...old, schema }));
    }
  }

  componentDidMount() {
    if (this.props.formErrorSignal) {
      const extraErrors = Object.keys({ ...this.state.extraErrors }).length > 0;
      this.setState(old => ({ ...old, ...this.state.extraErrors }));
      this.props.formErrorSignal.emit(extraErrors);
    }
    this.isInitialLoadRef = false;
  }

  /**
   * Fills null/undefined values in data with schema defaults (mutates data).
   * @returns true if any null/undefined was replaced by a default
   */
  protected applySchemaDefaults(
    data: IDict<any> | undefined,
    schema: RJSFSchema,
  ): boolean {
    if (!data || !schema.properties) {
      return false;
    }
    let applied = false;
    const props = schema.properties as IDict;
    for (const [key, propSchema] of Object.entries(props)) {
      if (
        propSchema === null ||
        propSchema === undefined ||
        typeof propSchema !== 'object'
      ) {
        continue;
      }
      const val = data[key];
      if (val === null || val === undefined) {
        if (
          'default' in propSchema &&
          (propSchema as IDict).default !== undefined
        ) {
          data[key] = deepCopy((propSchema as IDict).default);
          applied = true;
        }
      } else if (
        propSchema.type === 'object' &&
        typeof val === 'object' &&
        val !== null &&
        !Array.isArray(val) &&
        (propSchema as IDict).properties
      ) {
        if (this.applySchemaDefaults(val as IDict, propSchema as RJSFSchema)) {
          applied = true;
        }
      }
    }
    return applied;
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: RJSFSchema,
    uiSchema: UiSchema,
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
            addable: false,
          },
          ...uiSchema[k],
        };

        if (v['items']['type'] === 'array') {
          uiSchema[k] = {
            items: {
              'ui:options': {
                orderable: false,
                removable: false,
                addable: false,
              },
              ...uiSchema[k]['items'],
            },

            ...uiSchema[k],
          };
        }
      }

      if (v['type'] === 'object') {
        this.processSchema(data, v, uiSchema[k]);
      }

      if (k === 'opacity') {
        uiSchema[k] = {
          'ui:field': 'opacity',
        };
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
    schema: RJSFSchema,
    uiSchema: UiSchema,
  ) {
    if (data) {
      delete data[entry];
    }
    if (schema.properties) {
      delete schema.properties[entry];
    }
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

    if (this.props.formChangedSignal) {
      this.props.formChangedSignal.emit(this.currentFormData || {});
    }

    if (this.props.formErrorSignal) {
      const extraErrors = Object.keys(this.state.extraErrors).length > 0;
      this.props.formErrorSignal.emit(extraErrors);
    }
    if (this.props.formContext === 'update') {
      if (!this.isInitialLoadRef) {
        this.syncData(this.currentFormData);
      } else {
        this.isInitialLoadRef = false;
      }
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
          classNames: 'jGIS-hidden-field',
        },
      };
      this.processSchema(formData, schema, uiSchema);

      const submitRef = React.createRef<HTMLButtonElement>();

      // When the parent "ok" button gets clicked, submit
      this.props.ok?.connect(() => {
        submitRef.current?.click();
      });
      return (
        <div
          className="jGIS-property-panel"
          data-path={this.props.filePath ?? ''}
        >
          <div
            className="jGIS-property-outer"
            onKeyUp={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitRef.current?.click();
              }
            }}
          >
            <WrappedFormComponent
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              formContext={
                {
                  model: this.props.model,
                  formData,
                  formSchemaRegistry: this.props.formSchemaRegistry,
                  docManager: this.props.formSchemaRegistry?.getDocManager?.(),
                } satisfies IJupyterGISFormContext
              }
              onSubmit={this.onFormSubmit.bind(this)}
              onChange={this.onFormChange.bind(this)}
              onBlur={this.onFormBlur.bind(this)}
              ok={this.props.ok}
              cancel={this.props.cancel}
              liveValidate
              children={
                <button
                  ref={submitRef}
                  type="submit"
                  style={{ display: 'none' }}
                />
              }
              extraErrors={this.state.extraErrors}
            />
          </div>
        </div>
      );
    }
  }

  protected currentFormData: IDict<any> | undefined;
}
