import { ISubmitEvent } from '@rjsf/core';
import * as React from 'react';
import { FormComponent } from '@jupyterlab/ui-components';
import validatorAjv8 from '@rjsf/validator-ajv8';
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

const WrappedFormComponent = (props: any): JSX.Element => {
  const { fields, ...rest } = props;
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

  componentDidUpdate(prevProps: IProps): void {
    if (prevProps.sourceData !== this.props.sourceData) {
      this.setState(old => ({ ...old, internalData: this.props.sourceData }));
    }

    if (prevProps.schema !== this.props.schema) {
      this.setState(old => ({ ...old, schema: this.props.schema }));
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

  removeArrayButton(schema: IDict, uiSchema: IDict): void {
    if (!schema || typeof schema !== 'object') {
      return;
    }

    if (!schema.properties || typeof schema.properties !== 'object') {
      return;
    }

    Object.entries(schema.properties as IDict).forEach(([k, v]) => {
      if (v && typeof v === 'object') {
        if (v['type'] === 'array') {
          uiSchema[k] = {
            'ui:options': {
              orderable: false,
              removable: false,
              addable: false
            }
          };
        } else if (v['type'] === 'object') {
          uiSchema[k] = {};
          this.removeArrayButton(v, uiSchema[k]);
        }
      }
    });

    uiSchema['Color'] = {
      'ui:widget': 'color'
    };
  }

  generateUiSchema(schema: IDict): IDict {
    const uiSchema = {
      additionalProperties: {
        'ui:label': false,
        classNames: 'jGIS-hidden-field'
      }
    };
    this.removeArrayButton(schema, uiSchema);
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

      const submitRef = React.createRef<HTMLButtonElement>();

      return (
        <div
          className="jGIS-property-panel"
          data-path={this.props.filePath ?? ''}
        >
          <div
            className="jGIS-property-outer jp-scrollbar-tiny"
            onKeyUp={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitRef.current?.click();
              }
            }}
          >
            <WrappedFormComponent
              schema={schema}
              uiSchema={this.generateUiSchema(this.props.schema)}
              formData={this.state.internalData}
              onSubmit={this.onFormSubmit}
              liveValidate
              // @ts-ignore
              onFocus={(id, value) => {
                this.props.syncSelectedField
                  ? this.props.syncSelectedField(
                      id,
                      value,
                      this.props.parentType
                    )
                  : null;
              }}
              // @ts-ignore
              onBlur={(id, value) => {
                this.props.syncSelectedField
                  ? this.props.syncSelectedField(
                      null,
                      value,
                      this.props.parentType
                    )
                  : null;
              }}
              children={
                <button
                  ref={submitRef}
                  type="submit"
                  style={{ display: 'none' }}
                />
              }
            />
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
              type="button"
              onClick={() => {
                submitRef.current?.click();
              }}
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
