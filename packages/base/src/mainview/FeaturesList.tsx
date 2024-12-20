import { faWindowMinimize } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict } from '@jupytergis/schema';
import React, { useState } from 'react';

interface IFeatureListsProps {
  features: IDict<any>;
}

const FeatureLists = ({ features }: IFeatureListsProps) => {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderFeature = (
    feature: Record<string, any>,
    parentKey = ''
  ): JSX.Element[] => {
    return Object.entries(feature).map(([key, value]) => {
      const uniqueKey = `${parentKey}-${key}`;
      const isObject = typeof value === 'object' && value !== null;

      return (
        <div key={uniqueKey} style={{ marginLeft: parentKey ? '10px' : '0' }}>
          <strong
            style={{ cursor: isObject ? 'pointer' : 'default' }}
            onClick={() => isObject && toggleExpand(uniqueKey)}
          >
            {key}
          </strong>
          :{' '}
          {isObject ? (
            expandedKeys[uniqueKey] ? (
              <div style={{ marginLeft: '10px' }}>
                {renderFeature(value, uniqueKey)}
              </div>
            ) : (
              <span style={{ color: 'blue', cursor: 'pointer' }}>
                Click to expand
              </span>
            )
          ) : (
            String(value)
          )}
        </div>
      );
    });
  };

  return (
    <>
      {Object.values(features).map((feature, index) => (
        <div
          key={index}
          className="jGIS-Remote-Pointer-Popup-Coordinates"
          style={{ top: 0, right: 0, height: '100%', background: '#0f0f0f' }}
        >
          <div className="jGIS-Remote-Pointer-Popup-Name">Feature:</div>
          {renderFeature(feature, `feature${index}`)}
        </div>
      ))}
    </>
  );
};

export default FeatureLists;
