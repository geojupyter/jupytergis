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
  onEditProperty: (propertyKey: string, value: any) => void;
}

const FeatureRow: React.FC<IFeatureRowProps> = ({
  propertyKey,
  value,
  showEditButton,
  onEditProperty,
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
            onEditProperty(propertyKey, value);
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
  featureIndex: number;
  editingFeatureIndex: number | null;
  editorMode: 'add' | 'edit' | null;
  editingPropertyKey: string | null;
  newPropertyKey: string;
  newPropertyValue: string;
  isSavingProperty: boolean;
  onEditProperty: (
    featureIndex: number,
    propertyKey: string,
    value: any,
  ) => void;
  onSaveProperty: (feature: any, featureIndex: number) => void;
  onCancelProperty: () => void;
  onNewPropertyKeyChange: (value: string) => void;
  onNewPropertyValueChange: (value: string) => void;
}

const FeaturePropertyList: React.FC<IFeaturePropertyListProps> = ({
  feature,
  featureIndex,
  editingFeatureIndex,
  editorMode,
  editingPropertyKey,
  newPropertyKey,
  newPropertyValue,
  isSavingProperty,
  onEditProperty,
  onSaveProperty,
  onCancelProperty,
  onNewPropertyKeyChange,
  onNewPropertyValueChange,
}) => {
  const isFeatureEditable = feature?._fromDrawTool === true;

  return (
    <>
      {Object.entries(feature)
        .filter(([_, value]) => typeof value !== 'object' || value === null)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => {
          const isEditingThisRow =
            editingFeatureIndex === featureIndex &&
            editorMode === 'edit' &&
            editingPropertyKey === key;

          if (isEditingThisRow) {
            return (
              <div key={key} className="jgis-identify-grid-body">
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
                  onChange={event =>
                    onNewPropertyValueChange(event.target.value)
                  }
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
            <FeatureRow
              key={key}
              propertyKey={key}
              value={value}
              showEditButton={isFeatureEditable && !key.startsWith('_')}
              onEditProperty={(propertyKey, propertyValue) =>
                onEditProperty(featureIndex, propertyKey, propertyValue)
              }
            />
          );
        })}
    </>
  );
};

interface IAddPropertyEditorProps {
  feature: any;
  featureIndex: number;
  editorMode: 'add' | 'edit' | null;
  newPropertyKey: string;
  newPropertyValue: string;
  isSavingProperty: boolean;
  onStartAddProperty: (featureIndex: number) => void;
  onSaveProperty: (feature: any, featureIndex: number) => void;
  onCancelProperty: () => void;
  onNewPropertyKeyChange: (value: string) => void;
  onNewPropertyValueChange: (value: string) => void;
}

const AddPropertyEditor: React.FC<IAddPropertyEditorProps> = ({
  feature,
  featureIndex,
  editorMode,
  newPropertyKey,
  newPropertyValue,
  isSavingProperty,
  onStartAddProperty,
  onSaveProperty,
  onCancelProperty,
  onNewPropertyKeyChange,
  onNewPropertyValueChange,
}) => {
  if (editorMode === 'add') {
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
      <button onClick={() => onStartAddProperty(featureIndex)}>+</button>
    </div>
  );
};

interface IFeatureCardProps {
  feature: any;
  featureIndex: number;
  isVisible: boolean;
  editorMode: 'add' | 'edit' | null;
  editingPropertyKey: string | null;
  featureTitle: string;
  newPropertyKey: string;
  newPropertyValue: string;
  isSavingProperty: boolean;
  onToggleVisibility: (index: number) => void;
  onHighlightFeature: (feature: any) => void;
  onEditProperty: (
    featureIndex: number,
    propertyKey: string,
    value: any,
  ) => void;
  onStartAddProperty: (featureIndex: number) => void;
  onSaveProperty: (feature: any, featureIndex: number) => void;
  onCancelProperty: () => void;
  onNewPropertyKeyChange: (value: string) => void;
  onNewPropertyValueChange: (value: string) => void;
}

const FeatureCard: React.FC<IFeatureCardProps> = ({
  feature,
  featureIndex,
  isVisible,
  editorMode,
  editingPropertyKey,
  featureTitle,
  newPropertyKey,
  newPropertyValue,
  isSavingProperty,
  onToggleVisibility,
  onHighlightFeature,
  onEditProperty,
  onStartAddProperty,
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
          <FeaturePropertyList
            feature={feature}
            featureIndex={featureIndex}
            editingFeatureIndex={editorMode ? featureIndex : null}
            editorMode={editorMode}
            editingPropertyKey={editingPropertyKey}
            newPropertyKey={newPropertyKey}
            newPropertyValue={newPropertyValue}
            isSavingProperty={isSavingProperty}
            onEditProperty={onEditProperty}
            onSaveProperty={onSaveProperty}
            onCancelProperty={onCancelProperty}
            onNewPropertyKeyChange={onNewPropertyKeyChange}
            onNewPropertyValueChange={onNewPropertyValueChange}
          />
          <AddPropertyEditor
            feature={feature}
            featureIndex={featureIndex}
            editorMode={editorMode}
            newPropertyKey={newPropertyKey}
            newPropertyValue={newPropertyValue}
            isSavingProperty={isSavingProperty}
            onStartAddProperty={onStartAddProperty}
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
  const [editorMode, setEditorMode] = useState<'add' | 'edit' | null>(null);
  const [editingPropertyKey, setEditingPropertyKey] = useState<string | null>(
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
    setEditorMode(null);
    setEditingPropertyKey(null);
    setNewPropertyKey('');
    setNewPropertyValue('');
    setIsSavingProperty(false);
  };

  const startAddProperty = (featureIndex: number) => {
    setEditingFeatureIndex(featureIndex);
    setEditorMode('add');
    setEditingPropertyKey(null);
    setNewPropertyKey('');
    setNewPropertyValue('');
  };

  const handleAddProperty = async (feature: any, featureIndex: number) => {
    const key = newPropertyKey.trim();
    const previousKey =
      editorMode === 'edit' ? editingPropertyKey?.trim() : undefined;
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
    const propertyUpdates: IDict<any> = { [key]: newPropertyValue };
    if (previousKey && previousKey !== key) {
      propertyUpdates[previousKey] = undefined;
    }

    const success = await patchGeoJSONFeatureProperties(
      sourceId,
      { featureId: feature._id },
      propertyUpdates,
    );

    if (success) {
      setFeatures(previous => {
        if (!previous) {
          return previous;
        }

        const updatedFeatures = { ...previous };
        const targetFeature = updatedFeatures[featureIndex];

        if (targetFeature) {
          const updatedTargetFeature: IDict<any> = { ...targetFeature };
          if (previousKey && previousKey !== key) {
            delete updatedTargetFeature[previousKey];
          }
          updatedTargetFeature[key] = newPropertyValue;
          updatedFeatures[featureIndex] = updatedTargetFeature;
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
            editorMode={
              editingFeatureIndex === featureIndex ? editorMode : null
            }
            editingPropertyKey={editingPropertyKey}
            featureTitle={getFeatureNameOrId(feature, featureIndex)}
            newPropertyKey={newPropertyKey}
            newPropertyValue={newPropertyValue}
            isSavingProperty={isSavingProperty}
            onToggleVisibility={toggleFeatureVisibility}
            onHighlightFeature={highlightFeatureOnMap}
            onEditProperty={(index, propertyKey, value) => {
              setEditingFeatureIndex(index);
              setEditorMode('edit');
              setEditingPropertyKey(propertyKey);
              setNewPropertyKey(propertyKey);
              setNewPropertyValue(String(value ?? ''));
            }}
            onStartAddProperty={startAddProperty}
            onSaveProperty={handleAddProperty}
            onCancelProperty={resetAddPropertyEditor}
            onNewPropertyKeyChange={setNewPropertyKey}
            onNewPropertyValueChange={setNewPropertyValue}
          />
        ))}
    </div>
  );
};
