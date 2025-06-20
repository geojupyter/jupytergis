import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useState, useEffect } from 'react';

type IMetaDataViewerProps = {
  model: IJupyterGISModel;
  // metadata: Record<string, any>;
};

const MetadataViewer = ({ model }: IMetaDataViewerProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentJgisLayerId, setCurrentJgisLayerId] = useState<string>('');
  const [metadata, setMetadata] = useState<Record<string, any>>({});

  useEffect(() => {
    setIsVisible(true);
  }, [metadata]);

  const _onClientSharedStateChanged = () => {
    const localState = model.sharedModel.awareness.getLocalState();

    if (!localState) {
      return;
    }

    const selectedJgisLayerId = Object.keys(localState.selected.value)[0];

    if (selectedJgisLayerId === currentJgisLayerId) {
      return;
    }

    setCurrentJgisLayerId(selectedJgisLayerId);

    const currentJgisLayer = model.getLayer(selectedJgisLayerId);

    if (currentJgisLayer?.type === 'StacLayer') {
      setMetadata(currentJgisLayer.parameters?.data.properties);
    }
  };

  useEffect(() => {
    model.clientStateChanged.connect(_onClientSharedStateChanged);

    return () => {
      model.clientStateChanged.disconnect(_onClientSharedStateChanged);
    };
  }, []);

  const renderMetaData = (data: Record<string, any>) => {
    return (
      <div style={{ marginLeft: '1em' }}>
        {Object.entries(data).map(([key, value]) => {
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
          ) {
            return (
              <div key={key}>
                <h3>{key}:</h3>
                {renderMetaData(value)}
              </div>
            );
          }
          return (
            <p key={key}>
              <b>{key}:</b> {String(value)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="jgis-scrollable jgis-metadata-viewer-container"
      style={{
        visibility: isVisible ? 'visible' : 'hidden',
      }}
    >
      <button
        onClick={() => setIsVisible(false)}
        aria-label="Close metadata viewer"
        title="Close"
      >
        ×
      </button>
      {renderMetaData(metadata)}
    </div>
  );
};

export default MetadataViewer;
