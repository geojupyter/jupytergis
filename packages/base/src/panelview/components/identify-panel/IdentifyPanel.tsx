import {
  IDict,
  IJupyterGISModel,
  IJupyterGISTracker
} from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { useEffect, useState } from 'react';
import { IControlPanelModel } from '../../../types';

export class IdentifyPanel extends Panel {
  constructor(options: IdentifyPanel.IOptions) {
    super();
    this._model = options.model;
    this._tracker = options.tracker;

    this.id = 'jupytergis::identifyPanel';
    this.title.caption = 'Identify';
    this.title.label = 'Identify';
    // this.addClass(LAYERS_PANEL_CLASS);

    this.addWidget(
      ReactWidget.create(
        <IdentifyPanelComponent
          controlPanelModel={this._model}
          tracker={this._tracker}
        ></IdentifyPanelComponent>
      )
    );
  }

  private _model: IControlPanelModel | undefined;
  private _tracker: IJupyterGISTracker;
}

export namespace IdentifyPanel {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
  }
}

interface IIdentifyComponentProps {
  controlPanelModel: IControlPanelModel;
  tracker: IJupyterGISTracker;
}

const IdentifyPanelComponent = ({
  controlPanelModel,
  tracker
}: IIdentifyComponentProps) => {
  const [features, setFeatures] = useState<IDict<any>>();
  const [jgisModel, setJgisModel] = useState<IJupyterGISModel | undefined>(
    controlPanelModel?.jGISModel
  );

  /**
   * Update the model when it changes.
   */
  controlPanelModel?.documentChanged.connect((_, widget) => {
    setJgisModel(widget?.context.model);
  });

  useEffect(() => {
    console.log('jgisModel', jgisModel);
    const handleClientStateChanged = () => {
      if (!jgisModel?.localState?.identifiedFeatures?.value) {
        return;
      }

      console.log('sanity');
      setFeatures(jgisModel.localState.identifiedFeatures.value);
    };

    // Initial state
    handleClientStateChanged();

    jgisModel?.clientStateChanged.connect(handleClientStateChanged);

    return () => {
      jgisModel?.clientStateChanged.disconnect(handleClientStateChanged);
    };
  }, [jgisModel]);

  return (
    <div>
      {features &&
        Object.values(features).map((feature, featureIndex) => (
          <div
            key={featureIndex}
            className="jGIS-Remote-Pointer-Popup-Coordinates"
          >
            <div className="jGIS-Remote-Pointer-Popup-Name">Feature:</div>
            {Object.entries(feature)
              .filter(
                ([key, value]) => typeof value !== 'object' || value === null
              )
              .map(([key, value]) => (
                <div key={key}>
                  <strong>{key}</strong>:{' '}
                  {typeof value === 'string' &&
                  /<\/?[a-z][\s\S]*>/i.test(value) ? (
                    // Render HTML if the value contains HTML tags
                    <span dangerouslySetInnerHTML={{ __html: value }} />
                  ) : (
                    // Render other types as plain text
                    String(value)
                  )}
                </div>
              ))}
          </div>
        ))}
    </div>
  );
};

export default IdentifyPanel;
