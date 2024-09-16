import { GeoJSONFeature1 } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';
import { ISymbologyDialogProps } from '../../symbologyDialog';

const Graduated = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const [selectedValue, setSelectedValue] = useState('');
  const [featureProperties, setFeatureProperties] = useState<any>({});

  useEffect(() => {
    const getProperties = async () => {
      if (!layerId) {
        return;
      }
      const model = context.model;

      const layer = model.getLayer(layerId);

      const source = model.getSource(layer?.parameters?.source);

      if (!source) {
        return;
      }

      const data = await model.readGeoJSON(source.parameters?.path);
      const featureProps: any = {};

      data?.features.forEach((feature: GeoJSONFeature1) => {
        feature.properties &&
          Object.entries(feature.properties).forEach(([key, value]) => {
            if (!(key in featureProps)) {
              featureProps[key] = new Set();
            }

            featureProps[key].add(value);
          });

        setFeatureProperties(featureProps);
        //   addFeatureValue(feature.properties, aggregatedProperties);
      });
    };

    getProperties();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="jp-gis-symbology-row">
        <label htmlFor={'vector-value-select'}>Value:</label>
        <div className="jp-select-wrapper">
          <select
            name={'vector-value-select'}
            onChange={event => setSelectedValue(event.target.value)}
            className="jp-mod-styled"
          >
            {Object.keys(featureProperties).map((feature, featureIndex) => (
              <option
                key={featureIndex}
                value={feature}
                selected={feature === selectedValue}
                className="jp-mod-styled"
              >
                {feature}
              </option>
            ))}
          </select>
        </div>
      </div>
      <span>symbol</span>
      <span>method</span>
      <span>symbol rows</span>
    </div>
  );
};

export default Graduated;
