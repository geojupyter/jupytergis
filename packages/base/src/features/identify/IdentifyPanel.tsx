import {
  IDict,
  IIdentifiedFeature,
  IIdentifiedFeatureEntry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { User } from '@jupyterlab/services';
import React, { useEffect, useRef, useState } from 'react';

import { FeatureCard } from './components/FeatureCard';
import { useIdentifyPropertyEditor } from './hooks/useIdentifyPropertyEditor';
import { PatchGeoJSONFeatureProperties } from './types/editorTypes';
import { getFeatureIdentifier } from './utils/getFeatureIdentifier';

interface IIdentifyComponentProps {
  model: IJupyterGISModel;
  patchGeoJSONFeatureProperties?: PatchGeoJSONFeatureProperties;
}

export const IdentifyPanelComponent: React.FC<IIdentifyComponentProps> = ({
  model,
  patchGeoJSONFeatureProperties,
}) => {
  const [features, setFeatures] = useState<IIdentifiedFeatureEntry[]>([]);
  const [visibleRows, setVisibleRows] = useState<IDict<any>>({
    0: true,
  });
  const [remoteUser, setRemoteUser] = useState<User.IIdentity | null>(null);

  const featuresRef = useRef(features);
  const { editorState, editorActions } = useIdentifyPropertyEditor({
    model,
    patchGeoJSONFeatureProperties,
    setFeatures,
  });

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    const handleIdentifyFeaturesChanged = () => {
      const clients = model.sharedModel.awareness.getStates();
      const remoteUserId = model?.localState?.remoteUser;

      // If following a collaborator
      if (remoteUserId) {
        const remoteState = clients.get(remoteUserId);
        if (remoteState) {
          setRemoteUser(previousUser =>
            previousUser?.username === remoteState.user?.username
              ? previousUser
              : remoteState.user,
          );

          setFeatures(remoteState.identifiedFeatures?.value ?? []);
        }
        return;
      }

      setRemoteUser(previousUser => (previousUser ? null : previousUser));

      // If not following a collaborator
      const identifiedFeatures = model?.localState?.identifiedFeatures?.value;

      if (!identifiedFeatures) {
        setFeatures([]);
        return;
      }

      if (
        model.currentMode === 'identifying' &&
        featuresRef.current !== identifiedFeatures
      ) {
        setFeatures(identifiedFeatures);
      }
    };

    const signals = [
      model?.identifiedFeaturesChanged,
      model?.remoteUserChanged,
    ];

    signals.forEach(signal => signal.connect(handleIdentifyFeaturesChanged));
    handleIdentifyFeaturesChanged();

    return () => {
      signals.forEach(signal =>
        signal.disconnect(handleIdentifyFeaturesChanged),
      );
    };
  }, [model]);

  const highlightFeatureOnMap = (feature: IIdentifiedFeature) => {
    model?.highlightFeatureSignal?.emit(feature);

    const geometry = feature.geometry || feature._geometry;
    model?.flyToGeometrySignal?.emit(geometry);
  };

  const toggleFeatureVisibility = (rowIndex: number, isOpen: boolean) => {
    setVisibleRows(prev => ({
      ...prev,
      [rowIndex]: isOpen,
    }));
  };

  const toggleFeatureFloater = (feature: IIdentifiedFeature) => {
    const featureId = getFeatureIdentifier(feature);
    if (!featureId) {
      return;
    }

    setFeatures(previous => {
      const nextFeatures = previous.map(item =>
        getFeatureIdentifier(item.feature) === featureId
          ? { ...item, floaterOpen: !item.floaterOpen }
          : item,
      );

      model.syncIdentifiedFeatures(
        nextFeatures,
        model.getClientId().toString(),
      );
      return nextFeatures;
    });
  };

  const getFeatureNameOrId = (
    feature: IIdentifiedFeature,
    featureIndex: number,
  ): string => {
    for (const key of Object.keys(feature)) {
      const lowerCase = key.toLowerCase();

      if (
        (lowerCase.includes('label') ||
          lowerCase.includes('name') ||
          lowerCase === 'id') &&
        feature[key]
      ) {
        return String(feature[key]);
      }
    }

    return `Feature ${featureIndex + 1}`;
  };

  return (
    <div
      className="jgis-identify-wrapper"
      style={{
        border: model?.localState?.remoteUser
          ? `solid 3px ${remoteUser?.color}`
          : 'unset',
      }}
    >
      {!features.length && (
        <div style={{ textAlign: 'center' }}>
          Please select a layer from the layer list, then "i" from the toolbar
          to start identifying features.
        </div>
      )}
      {features.map((item, rowIndex) => (
        <FeatureCard
          key={rowIndex}
          feature={item.feature}
          rowIndex={rowIndex}
          isVisible={!!visibleRows[rowIndex]}
          featureTitle={getFeatureNameOrId(item.feature, rowIndex)}
          isFloaterOpen={!!item.floaterOpen}
          editorState={editorState}
          editorActions={editorActions}
          onToggleVisibility={toggleFeatureVisibility}
          onToggleFloater={() => toggleFeatureFloater(item.feature)}
          onHighlightFeature={highlightFeatureOnMap}
        />
      ))}
    </div>
  );
};
