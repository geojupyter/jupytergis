import {
  IDict,
  IJupyterGISClientState,
  IJupyterGISModel,
  IJupyterGISTracker
} from '@jupytergis/schema';
import { LabIcon, ReactWidget, caretDownIcon } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { useEffect, useRef, useState } from 'react';
import { IControlPanelModel } from '../../../types';
import { User } from '@jupyterlab/services';

export class IdentifyPanel extends Panel {
  constructor(options: IdentifyPanel.IOptions) {
    super();
    this._model = options.model;
    this._tracker = options.tracker;

    this.id = 'jupytergis::identifyPanel';
    this.title.caption = 'Identify';
    this.title.label = 'Identify';
    this.addClass('jgis-scrollable');

    this.addWidget(
      ReactWidget.create(
        <IdentifyPanelComponent
          controlPanelModel={this._model}
          tracker={this._tracker}
        />
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
  const [visibleFeatures, setVisibleFeatures] = useState<IDict<any>>({
    0: true
  });
  const [remoteUser, setRemoteUser] = useState<User.IIdentity | null>(null);
  const [jgisModel, setJgisModel] = useState<IJupyterGISModel | undefined>(
    controlPanelModel?.jGISModel
  );

  const featuresRef = useRef(features);
  /**
   * Update the model when it changes.
   */
  controlPanelModel?.documentChanged.connect((_, widget) => {
    setJgisModel(widget?.model);
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
      setVisibleFeatures({ 0: true });
    };
    tracker.currentChanged.connect(handleCurrentChanged);

    return () => {
      tracker.currentChanged.disconnect(handleCurrentChanged);
    };
  }, []);

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    const handleClientStateChanged = (
      sender: IJupyterGISModel,
      clients: Map<number, IJupyterGISClientState>
    ) => {
      const remoteUserId = jgisModel?.localState?.remoteUser;

      // If following a collaborator
      if (remoteUserId) {
        const remoteState = clients.get(remoteUserId);
        if (remoteState) {
          if (remoteState.user?.username !== remoteUser?.username) {
            setRemoteUser(remoteState.user);
          }

          setFeatures(remoteState.identifiedFeatures?.value ?? {});
        }
        return;
      }

      // If not following a collaborator
      const identifiedFeatures =
        jgisModel?.localState?.identifiedFeatures?.value;

      if (!identifiedFeatures) {
        setFeatures({});
        return;
      }

      if (
        jgisModel.isIdentifying &&
        featuresRef.current !== identifiedFeatures
      ) {
        setFeatures(identifiedFeatures);
      }
    };

    jgisModel?.clientStateChanged.connect(handleClientStateChanged);

    return () => {
      jgisModel?.clientStateChanged.disconnect(handleClientStateChanged);
    };
  }, [jgisModel]);

  const flyToGeometry = (geometry: any) => {
    jgisModel?.flyToGeometry?.(geometry);
  };

  const highlightFeatureOnMap = (feature: any) => {
    const geometry = feature.geometry || feature._geometry;
    jgisModel?.highlightFeatureOnMap?.(feature);
    flyToGeometry(geometry);
  };

  const toggleFeatureVisibility = (index: number, feature: any) => {
    setVisibleFeatures(prev => ({
      ...prev,
      [index]: !prev[index]
    }));

    highlightFeatureOnMap(feature);
  };

  return (
    <div
      className="jgis-identify-wrapper"
      style={{
        border: jgisModel?.localState?.remoteUser
          ? `solid 3px ${remoteUser?.color}`
          : 'unset'
      }}
    >
      {features &&
        Object.values(features).map((feature, featureIndex) => (
          <div key={featureIndex} className="jgis-identify-grid-item">
            <div
              className="jgis-identify-grid-item-header"
              onClick={() => toggleFeatureVisibility(featureIndex, feature)}
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
