import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/apputils';
import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import * as React from 'react';
import { v4 as uuid } from 'uuid';

import { EditForm } from '@/src/formbuilder/editform';

export class ObjectProperties extends PanelWithToolbar {
  constructor(params: ObjectProperties.IOptions) {
    super(params);
    this.title.label = 'Objects Properties';
    const body = ReactWidget.create(
      <ObjectPropertiesReact
        formSchemaRegistry={params.formSchemaRegistry}
        model={params.model}
      />,
    );
    this.addWidget(body);
    this.addClass('jGIS-sidebar-propertiespanel');
  }
}

interface IStates {
  model: IJupyterGISModel | undefined;
  selectedObject?: string;
  clientId: number | null; // ID of the yjs client
  id: string; // ID of the component, it is used to identify which component
  //is the source of awareness updates.
}

interface IProps {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  model: IJupyterGISModel;
}

class ObjectPropertiesReact extends React.Component<IProps, IStates> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      clientId: null,
      id: uuid(),
      model: props.model,
    };

    this.props.model?.sharedLayersChanged.connect(this._sharedJGISModelChanged);
    this.props.model?.sharedSourcesChanged.connect(
      this._sharedJGISModelChanged,
    );
  }

  private _sharedJGISModelChanged = (): void => {
    this.forceUpdate();
  };

  render(): React.ReactNode {
    const selectedObject = this.state.selectedObject;

    if (!selectedObject || !this.state.model) {
      return <div></div>;
    }

    let layerId: string | undefined = undefined;
    let sourceId: string | undefined = undefined;
    const layer = this.state.model.getLayer(selectedObject);
    if (layer) {
      layerId = selectedObject;
      sourceId = layer.parameters?.source;
    } else {
      const source = this.state.model.getSource(selectedObject);

      if (source) {
        sourceId = selectedObject;
      }
    }

    return (
      <EditForm
        layer={layerId}
        source={sourceId}
        formSchemaRegistry={this.props.formSchemaRegistry}
        model={this.state.model}
      />
    );
  }
}

export namespace ObjectProperties {
  /**
   * Instantiation options for `ObjectProperties`.
   */
  export interface IOptions extends Panel.IOptions {
    model: IJupyterGISModel;
    formSchemaRegistry: IJGISFormSchemaRegistry;
  }
}
