import { faWindowMinimize } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict } from '@jupytergis/schema';
import React, { useState } from 'react';

interface IFeatureListsProps {
  features: IDict<any>;
}

const FeatureLists = ({ features }: IFeatureListsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatValue = (value: any) =>
    typeof value === 'object' && value !== null
      ? JSON.stringify(value, null, 2)
      : String(value);

  return (
    <div
      style={{
        top: 0,
        right: 0,
        height: '100%',
        background: '#0f0f0f',
        visibility: isOpen ? 'visible' : 'hidden'
      }}
      className="jGIS-Remote-Pointer-Popup jGIS-Floating-Pointer-Popup"
    >
      <div
        className="jGIS-Popup-Topbar"
        onClick={() => {
          setIsOpen(false);
        }}
      >
        <FontAwesomeIcon
          icon={faWindowMinimize}
          className="jGIS-Popup-TopBarIcon"
        />
      </div>
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
                  <strong>{key}</strong>: {String(value)}
                </div>
              ))}
          </div>
        ))}
    </div>
  );
};

export default FeatureLists;
