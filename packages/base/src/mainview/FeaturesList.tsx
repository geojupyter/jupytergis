import { IDict } from '@jupytergis/schema';
import React from 'react';

interface IFeatureListsProps {
  features: IDict<any>;
}

const FeatureLists = ({ features }: IFeatureListsProps) => {
  return (
    <div
      style={{
        top: 0,
        right: 0,
        height: '100%',
        background: '#0f0f0f'
      }}
      className="jGIS-Remote-Pointer-Popup jGIS-Floating-Pointer-Popup"
    >
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

export default FeatureLists;
