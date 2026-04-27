import React from 'react';

interface IFeatureFloaterProps {
  feature: any;
}

const FeatureFloater: React.FC<IFeatureFloaterProps> = ({ feature }) => {
  const title =
    feature?.name ??
    feature?.Name ??
    feature?.title ??
    feature?.Title ??
    feature?.id ??
    feature?._id ??
    'Feature';

  const entries = Object.entries(feature ?? {})
    .filter(([key, value]) => {
      if (key === 'geometry' || key === '_geometry') {
        return false;
      }
      return typeof value !== 'object' || value === null;
    })
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  return (
    <div className="jGIS-FeatureFloater">
      <div className="jGIS-FeatureFloater-title">{String(title)}</div>
      {entries.map(([key, value]) => (
        <div className="jGIS-FeatureFloater-row" key={key}>
          <strong className="jGIS-FeatureFloater-key">{key}</strong>
          <span className="jGIS-FeatureFloater-value">{String(value)}</span>
        </div>
      ))}
    </div>
  );
};

export default FeatureFloater;
