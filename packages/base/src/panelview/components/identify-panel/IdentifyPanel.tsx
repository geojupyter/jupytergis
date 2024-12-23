import {
  IDict,
  IJupyterGISModel,
  IJupyterGISTracker
} from '@jupytergis/schema';
import { LabIcon, ReactWidget, caretDownIcon } from '@jupyterlab/ui-components';
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
  const [visibleFeatures, setVisibleFeatures] = useState<IDict<any>>({});
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

      if (features !== jgisModel.localState.identifiedFeatures.value) {
        console.log('sanity');
        setFeatures(jgisModel.localState.identifiedFeatures.value);
      }
    };

    // Initial state
    handleClientStateChanged();

    jgisModel?.clientStateChanged.connect(handleClientStateChanged);

    return () => {
      jgisModel?.clientStateChanged.disconnect(handleClientStateChanged);
    };
  }, [jgisModel]);

  const toggleFeatureVisibility = (index: number) => {
    console.log('visibleFeatures', visibleFeatures);
    setVisibleFeatures(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <>
      {features && (
        <div className="grid-container">
          {Object.values(features).map((feature, featureIndex) => (
            <div key={featureIndex} className="grid-item">
              <div
                className="grid-item-header"
                onClick={() => toggleFeatureVisibility(featureIndex)}
              >
                <LabIcon.resolveReact
                  icon={caretDownIcon}
                  className={`jp-gis-layerGroupCollapser${visibleFeatures[featureIndex] ? ' jp-mod-expanded' : ''}`}
                  tag={'span'}
                />
                Feature {featureIndex + 1}:
              </div>
              {visibleFeatures[featureIndex] && (
                <div className="jgis-identify-body">
                  {Object.entries(feature)
                    .filter(
                      ([key, value]) =>
                        typeof value !== 'object' || value === null
                    )
                    .map(([key, value]) => (
                      <div key={key} className="jgis-identify-body-content">
                        <strong>{key}:</strong>
                        {typeof value === 'string' &&
                        /<\/?[a-z][\s\S]*>/i.test(value) ? (
                          <span
                            className="jgis-identify-body-body"
                            dangerouslySetInnerHTML={{ __html: `${value}` }}
                          />
                        ) : (
                          String(value)
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default IdentifyPanel;
