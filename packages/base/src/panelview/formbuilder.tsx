import { SchemaForm } from '@deathbeds/jupyterlab-rjsf';
import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { IChangeEvent, ISubmitEvent } from '@rjsf/core';
import * as React from 'react';

import { IDict } from '../types';
import { IJupyterGISModel } from '@jupytergis/schema';

interface IStates {
  internalData?: IDict;
  schema?: IDict;
}

interface IProps {
  parentType: 'dialog' | 'panel';
  sourceData: IDict | undefined;
  filePath?: string;
  model: IJupyterGISModel;
  syncData: (properties: IDict) => void;
  syncSelectedField?: (
    id: string | null,
    value: any,
    parentType: 'panel' | 'dialog'
  ) => void;
  schema?: IDict;
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
    const sourceData = { ...this.props.sourceData };
    this.state = {
      internalData: sourceData,
      schema: props.schema
    };
  }

  componentDidUpdate(prevProps: IProps, prevState: IStates): void {
    if (prevProps.sourceData !== this.props.sourceData) {
      const sourceData = { ...this.props.sourceData };
      this.setState(old => ({ ...old, internalData: sourceData }));
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

      // Don't show readOnly properties when coming from the properties panel
      if (v['readOnly'] && this.props.parentType === 'panel') {
        uiSchema[k] = {
          'ui:widget': 'hidden',
          ...uiSchema[k]
        };
      }
    });
  }

  protected syncData(properties: IDict<any>) {
    this.props.syncData(properties);
  }

  protected onFormChange(e: IChangeEvent) {
    // This is a no-op here
  }

  protected onFormBlur(id: string, value: any) {
    // This is a no-op here
  }

  private onFormSubmit = (e: ISubmitEvent<any>): void => {
    const internalData = { ...this.state.internalData };
    Object.entries(e.formData).forEach(([k, v]) => (internalData[k] = v));
    this.setState(
      old => ({
        ...old,
        internalData
      }),
      () => {
        this.syncData(e.formData);
        this.props.cancel && this.props.cancel();
      }
    );
  };

  render(): React.ReactNode {
    if (this.props.schema) {
      const schema = { ...this.props.schema, additionalProperties: true };
      const formData = this.state.internalData;

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
        onFocus: (id, value) => {
          this.props.syncSelectedField
            ? this.props.syncSelectedField(id, value, this.props.parentType)
            : null;
        },
        onBlur: (id, value) => {
          this.props.syncSelectedField
            ? this.props.syncSelectedField(null, value, this.props.parentType)
            : null;
          this.onFormBlur(id, value);
        },
        uiSchema,
        children: (
          <button ref={submitRef} type="submit" style={{ display: 'none' }} />
        )
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
              <div className="jp-Dialog-buttonLabel">Submit</div>
            </button>
          </div>
        </div>
      );
    }
  }
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
    // Is there a better way to spot the url text entry?
    if (!id.endsWith('_url')) {
      return;
    }
    const internalData = this.state.internalData;
    if (internalData) {
      internalData.url = value;
    }
    this.setState({ internalData });
    this.forceUpdate();
  }
}
