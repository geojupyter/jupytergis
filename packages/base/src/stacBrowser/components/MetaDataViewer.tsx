import React, { useState, useEffect } from 'react';

type IMetaDataViewerProps = {
  metadata: Record<string, any>;
};

const MetaDataViewer = ({ metadata }: IMetaDataViewerProps) => {
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
      className="jgis-scrollable"
      style={{
        position: 'absolute',
        top: '5px',
        right: '5px',
        width: '30%',
        padding: '0 0.5rem',
        overflowY: 'auto',
        backgroundColor: 'var(--jp-layout-color0)',
        wordBreak: 'break-word',
        zIndex: 40,
        height: '95%',
        border: '0.75rem solid transparent',
        borderRadius: 'var(--jp-border-radius)',
        visibility: isVisible ? 'visible' : 'hidden',
      }}
    >
      <button
        onClick={() => setIsVisible(false)}
        style={{
          position: 'absolute',
          background: 'transparent',
          border: 'none',
          fontSize: '1.2rem',
          cursor: 'pointer',
          right: '0.7rem',
        }}
        aria-label="Close metadata viewer"
        title="Close"
      >
        ×
      </button>
      {renderMetaData(metadata)}
    </div>
  );
};

export default MetaDataViewer;
