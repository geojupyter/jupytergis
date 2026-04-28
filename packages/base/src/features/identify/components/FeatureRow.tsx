import { Button } from '@/src/shared/components/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/shared/components/DropdownMenu';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import React from 'react';

interface IFeatureRowProps {
  feature: any;
  rowIndex: number;
  propertyKey: string;
  value: any;
  showEditButton: boolean;
  onEditProperty: (propertyKey: string, value: any) => void;
  onDeleteProperty: (feature: any, rowIndex: number, propertyKey: string) => void;
}

export const FeatureRow: React.FC<IFeatureRowProps> = ({
  feature,
  rowIndex,
  propertyKey,
  value,
  showEditButton,
  onEditProperty,
  onDeleteProperty,
}) => {
  return (
    <div className="jgis-identify-row">
      <strong className="jgis-identify-col-key">{propertyKey}</strong>
      <span className="jgis-identify-col-value">{String(value)}</span>
      {showEditButton && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              className="jgis-identify-col-actions"
              title="Property actions"
              variant="icon"
              size="icon-md"
              onClick={event => {
                event.stopPropagation();
              }}
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" onClick={event => event.stopPropagation()}>
            <DropdownMenuItem
              onSelect={() => {
                onEditProperty(propertyKey, value);
              }}
            >
              <Pencil data-icon="inline-start" className="jgis-inline-icon" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                onDeleteProperty(feature, rowIndex, propertyKey);
              }}
            >
              <Trash2 data-icon="inline-start" className="jgis-inline-icon" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
