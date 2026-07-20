import { IIdentifiedFeature } from '@jupytergis/schema';
import { Pencil, Trash2 } from 'lucide-react';
import React from 'react';

import { AttributeActionsMenu } from './AttributeEditors';

interface IFeatureRowProps {
  feature: IIdentifiedFeature;
  rowIndex: number;
  attributeKey: string;
  value: unknown;
  showActions: boolean;
  onEditAttribute: (attributeKey: string, value: unknown) => void;
  onDeleteAttribute: (
    feature: IIdentifiedFeature,
    rowIndex: number,
    attributeKey: string,
  ) => void;
}

export const FeatureRow: React.FC<IFeatureRowProps> = ({
  feature,
  rowIndex,
  attributeKey,
  value,
  showActions,
  onEditAttribute,
  onDeleteAttribute,
}) => {
  return (
    <div className="jgis-identify-row">
      <strong className="jgis-identify-col-key">{attributeKey}</strong>
      <span className="jgis-identify-col-value">{String(value)}</span>
      {showActions && (
        <AttributeActionsMenu
          onContentClick={event => event.stopPropagation()}
          items={[
            {
              label: 'Edit',
              icon: (
                <Pencil data-icon="inline-start" className="jgis-inline-icon" />
              ),
              onSelect: () => {
                onEditAttribute(attributeKey, value);
              },
            },
            {
              label: 'Delete',
              icon: (
                <Trash2 data-icon="inline-start" className="jgis-inline-icon" />
              ),
              variant: 'destructive',
              onSelect: () => {
                onDeleteAttribute(feature, rowIndex, attributeKey);
              },
            },
          ]}
        />
      )}
    </div>
  );
};
