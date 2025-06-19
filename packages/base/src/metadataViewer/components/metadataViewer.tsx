import React, { useState, useEffect } from 'react';

type IMetaDataViewerProps = {
  metadata: Record<string, any>;
};

const MetadataViewer = ({ metadata }: IMetaDataViewerProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, [metadata]);

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
