import { SchemaForm } from '@deathbeds/jupyterlab-rjsf';
import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { IChangeEvent, ISubmitEvent } from '@rjsf/core';
import { Ajv, ValidateFunction } from 'ajv';
import * as geojson from 'geojson-schema/GeoJSON.json';
import * as React from 'react';

import { IDict } from './types';
import { IJupyterGISModel } from '@jupytergis/schema';
import { deepCopy } from './tools';

interface IStates {
  schema?: IDict;
  extraErrors?: any;
}

interface IProps {
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
   * The schema for the rjsf form
   */
  schema?: IDict;

  /**
   * Cancel callback, no cancel button will be displayed if not defined
   */
  cancel?: () => void;
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

export class ObjectPropertiesForm extends React.Component<IProps, IStates> {
  constructor(props: IProps) {
    super(props);
    this.currentFormData = deepCopy(this.props.sourceData);
    this.state = {
      schema: props.schema
    };
  }

  componentDidUpdate(prevProps: IProps, prevState: IStates): void {
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
          <div className="jGIS-property-buttons">
            {this.props.cancel ? (
              <button
                className="jp-Dialog-button jp-mod-reject jp-mod-styled"
                onClick={this.props.cancel}
              >
                <div className="jp-Dialog-buttonLabel">Cancel</div>
              </button>
            ) : null}

            <button
              className="jp-Dialog-button jp-mod-accept jp-mod-styled"
              onClick={() => submitRef.current?.click()}
            >
              <div className="jp-Dialog-buttonLabel">Ok</div>
            </button>
          </div>
        </div>
      );
    }
  }

  protected currentFormData: IDict<any> | undefined;
}

interface ILayerProps extends IProps {
  sourceType: string;
}

export class LayerPropertiesForm extends ObjectPropertiesForm {
  props: ILayerProps;

  constructor(props: ILayerProps) {
    super(props);
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ): void {
    super.processSchema(data, schema, uiSchema);

    if (!schema.properties.source) {
      return;
    }

    // Replace the source text box by a dropdown menu
    const availableSources = this.props.model.getSourcesByType(
      this.props.sourceType
    );

    schema.properties.source.enumNames = Object.values(availableSources);
    schema.properties.source.enum = Object.keys(availableSources);
  }
}

export class RasterSourcePropertiesForm extends ObjectPropertiesForm {
  private _urlParameters: string[] = [];

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);

    if (!schema.properties || !data) {
      return;
    }

    // Grep all url-parameters from the url
    const regex = /\{([^}]+)\}/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(data.url)) !== null) {
      if (['max_zoom', 'min_zoom', 'x', 'y', 'z'].includes(match[1])) {
        continue;
      }
      matches.push(match[1]);
    }

    this._urlParameters = matches;

    if (matches.length === 0) {
      this.removeFormEntry('urlParameters', data, schema, uiSchema);
      return;
    }

    // Dynamically inject url parameters schema based of the url
    const propertiesSchema = {};
    schema.properties.urlParameters = {
      type: 'object',
      required: this._urlParameters,
      properties: propertiesSchema
    };

    for (const parameterName of this._urlParameters) {
      switch (parameterName) {
        // Special case for "time" where a date picker widget is nicer
        case 'time':
          propertiesSchema[parameterName] = {
            type: 'string',
            format: 'date'
          };
          break;
        default:
          propertiesSchema[parameterName] = {
            type: 'string'
          };
          break;
      }
    }
  }

  protected onFormBlur(id: string, value: any) {
    super.onFormBlur(id, value);

    // Is there a better way to spot the url text entry?
    if (!id.endsWith('_url')) {
      return;
    }

    // Force a rerender on url change, as it probably changes the schema
    this.forceUpdate();
  }
}

/**
 * The form to modify a vector layer.
 */
export class VectorLayerPropertiesForm extends LayerPropertiesForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);
    uiSchema['color'] = {
      'ui:widget': 'color'
    };
  }
}

/**
 * The form to modify a GeoJSON source.
 */
export class GeoJSONSourcePropertiesForm extends ObjectPropertiesForm {
  constructor(props: IProps) {
    super(props);
    const ajv = new Ajv();
    this._validate = ajv.compile(geojson);
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);
    if (!schema.properties || !data) {
      return;
    }

    if (data.path !== '') {
      this.removeFormEntry('data', data, schema, uiSchema);
    }
  }

  protected onFormBlur(id: string, value: any) {
    // Is there a better way to spot the path text entry?
    if (!id.endsWith('_path')) {
      return;
    }

    this._validatePath(value);
  }

  protected onFormSubmit = (e: ISubmitEvent<any>) => {
    if (this.state.extraErrors?.path?.__errors?.includes('Invalid path')) {
      return;
    }
    super.onFormSubmit(e);
  };

  /**
   * Validate the path, to avoid invalid path or invalid GeoJSON.
   *
   * @param path - the path to validate.
   */
  private async _validatePath(path: string) {
    const extraErrors: IDict = {
      path: {
        __errors: []
      }
    };

    this.props.model
      .readGeoJSON(path)
      .then(async geoJSONData => {
        const valid = this._validate(geoJSONData);
        if (!valid) {
          extraErrors.path.__errors = [
            "GeoJSON data invalid (you can still validate but the source can't be used)"
          ];
          this._validate.errors?.reverse().forEach(error => {
            extraErrors.path.__errors.push(error.message);
          });
        }
        this.setState({ extraErrors });
      })
      .catch(e => {
        extraErrors.path.__errors = ['Invalid path'];
        this.setState({ extraErrors });
      });
  }

  private _validate: ValidateFunction;
}

/**
 * The form to create a GeoJSON layer.
 */
export class GeoJSONLayerPropertiesForm extends GeoJSONSourcePropertiesForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);
    uiSchema['color'] = {
      'ui:widget': 'color'
    };
  }
}
