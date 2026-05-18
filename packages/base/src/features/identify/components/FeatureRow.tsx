import { IIdentifiedFeature } from '@jupytergis/schema';
import { Pencil, Trash2 } from 'lucide-react';
import React from 'react';

import { PropertyActionsMenu } from './PropertyEditors';

interface IFeatureRowProps {
  feature: IIdentifiedFeature;
  rowIndex: number;
  propertyKey: string;
  value: unknown;
  showActions: boolean;
  onEditProperty: (propertyKey: string, value: unknown) => void;
  onDeleteProperty: (
    feature: IIdentifiedFeature,
    rowIndex: number,
    propertyKey: string,
  ) => void;
}

export const FeatureRow: React.FC<IFeatureRowProps> = ({
  feature,
  rowIndex,
  propertyKey,
  value,
  showActions,
  onEditProperty,
  onDeleteProperty,
}) => {
  return (
    <div className="jgis-identify-row">
      <strong className="jgis-identify-col-key">{propertyKey}</strong>
      <span className="jgis-identify-col-value">{String(value)}</span>
      {showActions && (
        <PropertyActionsMenu
          onContentClick={event => event.stopPropagation()}
          items={[
            {
              label: 'Edit',
              icon: (
                <Pencil data-icon="inline-start" className="jgis-inline-icon" />
              ),
              onSelect: () => {
                onEditProperty(propertyKey, value);
              },
            },
            {
              label: 'Delete',
              icon: (
                <Trash2 data-icon="inline-start" className="jgis-inline-icon" />
              ),
              variant: 'destructive',
              onSelect: () => {
                onDeleteProperty(feature, rowIndex, propertyKey);
              },
            },
          ]}
        />
      )}
    </div>
  );
};
