import { SchemaForm } from '@deathbeds/jupyterlab-rjsf';
import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { ISubmitEvent } from '@rjsf/core';
import * as React from 'react';

import { IDict } from '../types';

interface IStates {
  internalData?: IDict;
  schema?: IDict;
}
interface IProps {
  parentType: 'dialog' | 'panel';
  sourceData: IDict | undefined;
  filePath?: string;
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
    this.state = {
      internalData: { ...this.props.sourceData },
      schema: props.schema
    };
  }

  setStateByKey = (key: string, value: any): void => {
    const floatValue = parseFloat(value);
    if (Number.isNaN(floatValue)) {
      return;
    }
    this.setState(
      old => ({
        ...old,
        internalData: { ...old.internalData, [key]: floatValue }
      }),
      () => this.props.syncData({ [key]: floatValue })
    );
  };

  componentDidUpdate(prevProps: IProps, prevState: IStates): void {
    if (prevProps.sourceData !== this.props.sourceData) {
      this.setState(old => ({ ...old, internalData: this.props.sourceData }));
    }
  }

  buildForm(): JSX.Element[] {
    if (!this.props.sourceData || !this.state.internalData) {
      return [];
    }
    const inputs: JSX.Element[] = [];

    for (const [key, value] of Object.entries(this.props.sourceData)) {
      let input: JSX.Element;
      if (typeof value === 'string' || typeof value === 'number') {
        input = (
          <div key={key}>
            <label htmlFor="">{key}</label>
            <input
              type="number"
              value={this.state.internalData[key]}
              onChange={e => this.setStateByKey(key, e.target.value)}
            />
          </div>
        );
        inputs.push(input);
      }
    }
    return inputs;
  }

  protected processSchema(data: IDict<any> | undefined, schema: IDict) {
    // This is a no-op here
  }

  protected processUISchema(schema: IDict, uiSchema: IDict): void {
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
        this.processUISchema(v, uiSchema[k]);
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

  generateUiSchema(schema: IDict): IDict {
    const uiSchema = {
      additionalProperties: {
        'ui:label': false,
        classNames: 'jGIS-hidden-field'
      }
    };
    this.processUISchema(schema, uiSchema);
    return uiSchema;
  }

  onFormSubmit = (e: ISubmitEvent<any>): void => {
    const internalData = { ...this.state.internalData };
    Object.entries(e.formData).forEach(([k, v]) => (internalData[k] = v));
    this.setState(
      old => ({
        ...old,
        internalData
      }),
      () => {
        this.props.syncData(e.formData);
        this.props.cancel && this.props.cancel();
      }
    );
  };

  render(): React.ReactNode {
    if (this.props.schema) {
      const schema = { ...this.props.schema, additionalProperties: true };
      const formData = this.state.internalData;
      this.processSchema(formData, schema);

      const submitRef = React.createRef<HTMLButtonElement>();

      const formSchema = new SchemaForm(schema, {
        liveValidate: true,
        formData,
        onSubmit: this.onFormSubmit,
        onFocus: (id, value) => {
          this.props.syncSelectedField
            ? this.props.syncSelectedField(id, value, this.props.parentType)
            : null;
        },
        onBlur: (id, value) => {
          this.props.syncSelectedField
            ? this.props.syncSelectedField(null, value, this.props.parentType)
            : null;
        },
        uiSchema: this.generateUiSchema(this.props.schema),
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
    } else {
      return <div>{this.buildForm()}</div>;
    }
  }
}

export class RasterSourcePropertiesForm extends ObjectPropertiesForm {
  processSchema(data: IDict<any> | undefined, schema: IDict) {
    super.processSchema(data, schema);

    if (!schema.properties || !data || !data.urlParameters) {
      return;
    }

    // Dynamically inject url parameters schema
    const propertiesSchema = {};
    schema.properties.urlParameters = {
      type: 'object',
      required: Object.keys(data.urlParameters),
      properties: propertiesSchema
    };
    for (const parameterName of Object.keys(data.urlParameters)) {
      switch (parameterName) {
        case 'time':
          propertiesSchema[parameterName] = {
            type: 'string',
            format: 'date'
          };
          break;
        case 'variant':
          propertiesSchema[parameterName] = {
            type: 'string'
          };
          break;
        case 'format':
          propertiesSchema[parameterName] = {
            type: 'string'
          };
          break;
      }
    }
  }
}
