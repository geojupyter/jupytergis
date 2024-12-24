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
  const [widgetId, setWidgetId] = useState('');
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

  // Reset state values when current widget changes
  useEffect(() => {
    const handleCurrentChanged = () => {
      if (tracker.currentWidget?.id === widgetId) {
        return;
      }

      if (tracker.currentWidget) {
        setWidgetId(tracker.currentWidget.id);
      }
      setFeatures({});
      setVisibleFeatures({});
    };
    tracker.currentChanged.connect(handleCurrentChanged);

    return () => {
      tracker.currentChanged.disconnect(handleCurrentChanged);
    };
  }, []);

  useEffect(() => {
    const handleClientStateChanged = () => {
      if (!jgisModel?.localState?.identifiedFeatures?.value) {
        return;
      }

      if (features !== jgisModel.localState.identifiedFeatures.value) {
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
    <div className="jgis-identify-wrapper">
      {features &&
        Object.values(features).map((feature, featureIndex) => (
          <div key={featureIndex} className="jgis-identify-grid-item">
            <div
              className="jgis-identify-grid-item-header"
              onClick={() => toggleFeatureVisibility(featureIndex)}
            >
              <LabIcon.resolveReact
                icon={caretDownIcon}
                className={`jp-gis-layerGroupCollapser${visibleFeatures[featureIndex] ? ' jp-mod-expanded' : ''}`}
                tag={'span'}
              />
              <span>Feature {featureIndex + 1}:</span>
            </div>
            {visibleFeatures[featureIndex] && (
              <>
                {Object.entries(feature)
                  .filter(
                    ([key, value]) =>
                      typeof value !== 'object' || value === null
                  )
                  .map(([key, value]) => (
                    <div key={key} className="jgis-identify-grid-body">
                      <strong>{key}:</strong>
                      {typeof value === 'string' &&
                      /<\/?[a-z][\s\S]*>/i.test(value) ? (
                        <span
                          dangerouslySetInnerHTML={{ __html: `${value}` }}
                        />
                      ) : (
                        <span>{String(value)}</span>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>
        ))}
    </div>
  );
};

export default IdentifyPanel;
