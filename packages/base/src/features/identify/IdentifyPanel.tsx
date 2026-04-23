import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { User } from '@jupyterlab/services';
import { LabIcon, caretDownIcon } from '@jupyterlab/ui-components';
import React, { useEffect, useRef, useState } from 'react';

interface IIdentifyComponentProps {
  model: IJupyterGISModel;
  persistAndRefreshSource?: (id: string, source: IJGISSource) => Promise<void>;
  patchGeoJSONFeatureProperties?: (
    sourceId: string,
    target: { featureId: string | number },
    propertyUpdates: IDict<any>,
  ) => Promise<boolean>;
}

interface IFeatureRowProps {
  propertyKey: string;
  value: any;
  showEditButton: boolean;
}

const FeatureRow: React.FC<IFeatureRowProps> = ({
  propertyKey,
  value,
  showEditButton,
}) => {
  return (
    <div className="jgis-identify-grid-body">
      <strong>{propertyKey}:</strong>
      <span>{String(value)}</span>
      {showEditButton && (
        <button
          type="button"
          title="Edit property"
          onClick={event => {
            event.stopPropagation();
          }}
        >
          Edit
        </button>
      )}
    </div>
  );
};

interface IFeatureCardHeaderProps {
  feature: any;
  featureIndex: number;
  isVisible: boolean;
  featureTitle: string;
  onToggleVisibility: (index: number) => void;
  onHighlightFeature: (feature: any) => void;
}

const FeatureCardHeader: React.FC<IFeatureCardHeaderProps> = ({
  feature,
  featureIndex,
  isVisible,
  featureTitle,
  onToggleVisibility,
  onHighlightFeature,
}) => {
  const isRasterFeature =
    !feature.geometry &&
    !feature._geometry &&
    typeof feature?.x !== 'number' &&
    typeof feature?.y !== 'number';

  return (
    <div className="jgis-identify-grid-item-header">
      <span onClick={() => onToggleVisibility(featureIndex)}>
        <LabIcon.resolveReact
          icon={caretDownIcon}
          className={`jp-gis-layerGroupCollapser${isVisible ? ' jp-mod-expanded' : ''}`}
          tag={'span'}
        />
        <span>{featureTitle}</span>
      </span>

      <button
        className="jgis-highlight-button"
        onClick={e => {
          e.stopPropagation();
          onHighlightFeature(feature);
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
    </div>
  );
};

interface IFeaturePropertyListProps {
  feature: any;
}

const FeaturePropertyList: React.FC<IFeaturePropertyListProps> = ({ feature }) => {
  const isFeatureEditable = feature?._fromDrawTool === true;

  return (
    <>
      {Object.entries(feature)
        .filter(([_, value]) => typeof value !== 'object' || value === null)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => (
          <FeatureRow
            key={key}
            propertyKey={key}
            value={value}
            showEditButton={isFeatureEditable && !key.startsWith('_')}
          />
        ))}
    </>
  );
};

interface IAddPropertyEditorProps {
  feature: any;
  featureIndex: number;
  isEditingProperty: boolean;
  newPropertyKey: string;
  newPropertyValue: string;
  isSavingProperty: boolean;
  onEditProperty: (featureIndex: number) => void;
  onSaveProperty: (feature: any, featureIndex: number) => void;
  onCancelProperty: () => void;
  onNewPropertyKeyChange: (value: string) => void;
  onNewPropertyValueChange: (value: string) => void;
}

const AddPropertyEditor: React.FC<IAddPropertyEditorProps> = ({
  feature,
  featureIndex,
  isEditingProperty,
  newPropertyKey,
  newPropertyValue,
  isSavingProperty,
  onEditProperty,
  onSaveProperty,
  onCancelProperty,
  onNewPropertyKeyChange,
  onNewPropertyValueChange,
}) => {
  if (isEditingProperty) {
    return (
      <div className="jgis-identify-grid-body">
        <input
          type="text"
          placeholder="key"
          value={newPropertyKey}
          onChange={event => onNewPropertyKeyChange(event.target.value)}
        />
        <input
          type="text"
          placeholder="value"
          value={newPropertyValue}
          onChange={event => onNewPropertyValueChange(event.target.value)}
        />
        <button
          onClick={() => onSaveProperty(feature, featureIndex)}
          disabled={!newPropertyKey.trim() || isSavingProperty}
        >
          Save
        </button>
        <button onClick={onCancelProperty}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="jgis-identify-grid-body">
      <button onClick={() => onEditProperty(featureIndex)}>+</button>
    </div>
  );
};

interface IFeatureCardProps {
  feature: any;
  featureIndex: number;
  isVisible: boolean;
  isEditingProperty: boolean;
  featureTitle: string;
  newPropertyKey: string;
  newPropertyValue: string;
  isSavingProperty: boolean;
  onToggleVisibility: (index: number) => void;
  onHighlightFeature: (feature: any) => void;
  onEditProperty: (featureIndex: number) => void;
  onSaveProperty: (feature: any, featureIndex: number) => void;
  onCancelProperty: () => void;
  onNewPropertyKeyChange: (value: string) => void;
  onNewPropertyValueChange: (value: string) => void;
}

const FeatureCard: React.FC<IFeatureCardProps> = ({
  feature,
  featureIndex,
  isVisible,
  isEditingProperty: isEditingFeature,
  featureTitle,
  newPropertyKey,
  newPropertyValue,
  isSavingProperty,
  onToggleVisibility,
  onHighlightFeature,
  onEditProperty,
  onSaveProperty,
  onCancelProperty,
  onNewPropertyKeyChange,
  onNewPropertyValueChange,
}) => {
  return (
    <div className="jgis-identify-grid-item">
      <FeatureCardHeader
        feature={feature}
        featureIndex={featureIndex}
        isVisible={isVisible}
        featureTitle={featureTitle}
        onToggleVisibility={onToggleVisibility}
        onHighlightFeature={onHighlightFeature}
      />
      {isVisible && (
        <>
          <FeaturePropertyList feature={feature} />
          <AddPropertyEditor
            feature={feature}
            featureIndex={featureIndex}
            isEditingProperty={isEditingFeature}
            newPropertyKey={newPropertyKey}
            newPropertyValue={newPropertyValue}
            isSavingProperty={isSavingProperty}
            onEditProperty={onEditProperty}
            onSaveProperty={onSaveProperty}
            onCancelProperty={onCancelProperty}
            onNewPropertyKeyChange={onNewPropertyKeyChange}
            onNewPropertyValueChange={onNewPropertyValueChange}
          />
        </>
      )}
    </div>
  );
};

export const IdentifyPanelComponent: React.FC<IIdentifyComponentProps> = ({
  model,
  patchGeoJSONFeatureProperties,
}) => {
  const [features, setFeatures] = useState<IDict<any>>();
  const [visibleFeatures, setVisibleFeatures] = useState<IDict<any>>({
    0: true,
  });
  const [remoteUser, setRemoteUser] = useState<User.IIdentity | null>(null);
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(
    null,
  );
  const [newPropertyKey, setNewPropertyKey] = useState('');
  const [newPropertyValue, setNewPropertyValue] = useState('');
  const [isSavingProperty, setIsSavingProperty] = useState(false);

  const featuresRef = useRef(features);

  // Reset state values when current widget changes

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

          setFeatures(remoteState.identifiedFeatures?.value ?? {});
        }
        return;
      }

      setRemoteUser(previousUser => (previousUser ? null : previousUser));

      // If not following a collaborator
      const identifiedFeatures = model?.localState?.identifiedFeatures?.value;

      if (!identifiedFeatures) {
        setFeatures({});
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

  const highlightFeatureOnMap = (feature: any) => {
    model?.highlightFeatureSignal?.emit(feature);

    const geometry = feature.geometry || feature._geometry;
    model?.flyToGeometrySignal?.emit(geometry);
  };

  const toggleFeatureVisibility = (index: number) => {
    setVisibleFeatures(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const getFeatureNameOrId = (feature: any, featureIndex: number) => {
    for (const key of Object.keys(feature)) {
      const lowerCase = key.toLowerCase();

      if ((lowerCase.includes('name') || lowerCase === 'id') && feature[key]) {
        return feature[key];
      }
    }

    return `Feature ${featureIndex + 1}`;
  };

  const resetAddPropertyEditor = () => {
    setEditingFeatureIndex(null);
    setNewPropertyKey('');
    setNewPropertyValue('');
    setIsSavingProperty(false);
  };

  const handleAddProperty = async (feature: any, featureIndex: number) => {
    const key = newPropertyKey.trim();
    if (!patchGeoJSONFeatureProperties || !key || isSavingProperty) {
      return;
    }

    const selectedLayers = model.localState?.selected?.value;
    if (!selectedLayers) {
      return;
    }

    const selectedLayerId = Object.keys(selectedLayers)[0];
    const selectedLayer = model.getLayer(selectedLayerId);
    const sourceId = selectedLayer?.parameters?.source;
    if (!sourceId) {
      return;
    }

    setIsSavingProperty(true);
    const success = await patchGeoJSONFeatureProperties(
      sourceId,
      { featureId: feature._id },
      { [key]: newPropertyValue },
    );

    if (success) {
      setFeatures(previous => {
        if (!previous) {
          return previous;
        }

        const updatedFeatures = { ...previous };
        const targetFeature = updatedFeatures[featureIndex];

        if (targetFeature) {
          updatedFeatures[featureIndex] = {
            ...targetFeature,
            [key]: newPropertyValue,
          };
        }

        return updatedFeatures;
      });
      resetAddPropertyEditor();
      return;
    }

    setIsSavingProperty(false);
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
      {!Object.keys(features ?? {}).length && (
        <div style={{ textAlign: 'center' }}>
          Please select a layer from the layer list, then "i" from the toolbar
          to start identifying features.
        </div>
      )}
      {features &&
        Object.values(features).map((feature, featureIndex) => (
          <FeatureCard
            key={featureIndex}
            feature={feature}
            featureIndex={featureIndex}
            isVisible={!!visibleFeatures[featureIndex]}
            isEditingProperty={editingFeatureIndex === featureIndex}
            featureTitle={getFeatureNameOrId(feature, featureIndex)}
            newPropertyKey={newPropertyKey}
            newPropertyValue={newPropertyValue}
            isSavingProperty={isSavingProperty}
            onToggleVisibility={toggleFeatureVisibility}
            onHighlightFeature={highlightFeatureOnMap}
            onEditProperty={index => {
              setEditingFeatureIndex(index);
              setNewPropertyKey('');
              setNewPropertyValue('');
            }}
            onSaveProperty={handleAddProperty}
            onCancelProperty={resetAddPropertyEditor}
            onNewPropertyKeyChange={setNewPropertyKey}
            onNewPropertyValueChange={setNewPropertyValue}
          />
        ))}
    </div>
  );
};
