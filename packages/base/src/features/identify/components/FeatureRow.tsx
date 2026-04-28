import { Button } from '@/src/shared/components/Button';
import { Pencil } from 'lucide-react';
import React from 'react';

interface IFeatureRowProps {
  propertyKey: string;
  value: any;
  showEditButton: boolean;
  onEditProperty: (propertyKey: string, value: any) => void;
}

export const FeatureRow: React.FC<IFeatureRowProps> = ({
  propertyKey,
  value,
  showEditButton,
  onEditProperty,
}) => {
  return (
    <div className="jgis-identify-row">
      <strong className="jgis-identify-col-key">{propertyKey}</strong>
      <span className="jgis-identify-col-value">{String(value)}</span>
      {showEditButton && (
        <Button
          type="button"
          className="jgis-identify-col-actions"
          title="Edit property"
          variant="icon"
          size="icon-md"
          onClick={event => {
            event.stopPropagation();
            onEditProperty(propertyKey, value);
          }}
        >
          <Pencil />
        </Button>
      )}
    </div>
  );
};
