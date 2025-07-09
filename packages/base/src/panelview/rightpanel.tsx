import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  JupyterGISDoc,
} from '@jupytergis/schema';
import { SidePanel } from '@jupyterlab/ui-components';
import * as React from 'react';

import { Annotations, AnnotationsPanel } from './annotationPanel';
import IdentifyPanel, {
  IdentifyPanelComponent,
} from './components/identify-panel/IdentifyPanel';
import { ControlPanelHeader } from './header';
import { ObjectPropertiesReact, ObjectProperties } from './objectproperties';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../shared/components/Tabs';

interface IRightComponentProps {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  annotationModel: IAnnotationModel;
  model: IJupyterGISModel;
}

export const RightPanelComponent = (options: IRightComponentProps) => {
  return (
    <div
      style={{
        width: 300,
        position: 'absolute',
        top: 30,
        right: 0,
      }}
    >
      <Tabs defaultValue="filters" className="jgis-stac-browser-main">
        <TabsList style={{ borderRadius: 5, fontSize: 8 }}>
          <TabsTrigger
            className="jGIS-layer-browser-category"
            value="objectProperties"
          >
            Object Properties
          </TabsTrigger>
          <TabsTrigger
            className="jGIS-layer-browser-category"
            value="annotations"
          >
            Annotations
          </TabsTrigger>
          <TabsTrigger
            className="jGIS-layer-browser-category"
            value="identifyPanel"
          >
            Identify Panels
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="objectProperties"
          style={{
            borderRadius: 5,
            fontSize: 10,
            backgroundColor: '#eef',
          }}
        >
          <ObjectPropertiesReact
            formSchemaRegistry={options.formSchemaRegistry}
            model={options.model}
          />
        </TabsContent>
        <TabsContent value="annotations">
          <AnnotationsPanel
            annotationModel={options.annotationModel}
            rightPanelModel={options.model}
          ></AnnotationsPanel>
        </TabsContent>
        <TabsContent
          value="identifyPanel"
          style={{
            borderRadius: 5,
            backgroundColor: '#eef',
          }}
        >
          <IdentifyPanelComponent
            model={options.model}
          ></IdentifyPanelComponent>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export class RightPanelWidget extends SidePanel {
  constructor(options: RightPanelWidget.IOptions) {
    super();
    this.addClass('jGIS-sidepanel-widget');
    this.addClass('data-jgis-keybinding');
    this.node.tabIndex = 0;

    this._model = options.model;
    this._annotationModel = options.annotationModel;

    const header = new ControlPanelHeader();
    this.header.addWidget(header);
    const properties = new ObjectProperties({
      formSchemaRegistry: options.formSchemaRegistry,
      model: options.model,
    });

    this.addWidget(properties);

    const annotations = new Annotations({
      rightPanelModel: this._model,
      annotationModel: this._annotationModel,
    });
    this.addWidget(annotations);

    const identifyPanel = new IdentifyPanel({
      model: this._model,
    });
    identifyPanel.title.caption = 'Identify';
    identifyPanel.title.label = 'Identify';
    identifyPanel.addClass('jgis-scrollable');
    this.addWidget(identifyPanel);
  }

  dispose(): void {
    super.dispose();
  }

  private _model: IJupyterGISModel;
  private _annotationModel: IAnnotationModel;
}

export namespace RightPanelWidget {
  export interface IOptions {
    formSchemaRegistry: IJGISFormSchemaRegistry;
    annotationModel: IAnnotationModel;
    model: IJupyterGISModel;
  }
  export interface IProps {
    filePath?: string;
    sharedModel?: JupyterGISDoc;
  }
}
