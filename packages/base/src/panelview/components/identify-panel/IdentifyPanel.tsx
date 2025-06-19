import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  IDict,
  IJupyterGISClientState,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { User } from '@jupyterlab/services';
import { LabIcon, caretDownIcon } from '@jupyterlab/ui-components';
import React, { useEffect, useRef, useState } from 'react';

interface IIdentifyComponentProps {
  model: IJupyterGISModel;
}

export const IdentifyPanelComponent = (options: IIdentifyComponentProps) => {
  const [features, setFeatures] = useState<IDict<any>>();
  const [visibleFeatures, setVisibleFeatures] = useState<IDict<any>>({
    0: true,
  });
  const [remoteUser, setRemoteUser] = useState<User.IIdentity | null>(null);
  const jgisModel = options.model;

  const featuresRef = useRef(features);

  // Reset state values when current widget changes

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    const handleClientStateChanged = (
      sender: IJupyterGISModel,
      clients: Map<number, IJupyterGISClientState>,
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

  const highlightFeatureOnMap = (feature: any) => {
    jgisModel?.highlightFeatureSignal?.emit(feature);

    const geometry = feature.geometry || feature._geometry;
    jgisModel?.flyToGeometrySignal?.emit(geometry);
  };

  const toggleFeatureVisibility = (index: number) => {
    setVisibleFeatures(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div
      className="jgis-identify-wrapper"
      style={{
        border: jgisModel?.localState?.remoteUser
          ? `solid 3px ${remoteUser?.color}`
          : 'unset',
      }}
    >
      {features &&
        Object.values(features).map((feature, featureIndex) => (
          <div key={featureIndex} className="jgis-identify-grid-item">
            <div className="jgis-identify-grid-item-header">
              <span onClick={() => toggleFeatureVisibility(featureIndex)}>
                <LabIcon.resolveReact
                  icon={caretDownIcon}
                  className={`jp-gis-layerGroupCollapser${visibleFeatures[featureIndex] ? ' jp-mod-expanded' : ''}`}
                  tag={'span'}
                />
                <span>Feature {featureIndex + 1}</span>
              </span>

              {(() => {
                const isRasterFeature =
                  !feature.geometry &&
                  !feature._geometry &&
                  typeof feature?.x !== 'number' &&
                  typeof feature?.y !== 'number';

                return (
                  <button
                    className="jgis-highlight-button"
                    onClick={e => {
                      e.stopPropagation();
                      highlightFeatureOnMap(feature);
                    }}
                    title={
                      isRasterFeature
                        ? 'Highlight not available for raster features'
                        : 'Highlight feature on map'
                    }
                    disabled={isRasterFeature}
                  >
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                  </button>
                );
              })()}
            </div>
            {visibleFeatures[featureIndex] && (
              <>
                {Object.entries(feature)
                  .filter(
                    ([key, value]) =>
                      typeof value !== 'object' || value === null,
                  )
                  .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                  .map(([key, value]) => (
                    <div key={key} className="jgis-identify-grid-body">
                      <strong>{key}:</strong>
                      {typeof value === 'string' &&
                      /<\/?[a-z][\s\S]*>/i.test(value) ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: `${value}`,
                          }}
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
