import { IIdentifiedFeature } from '@jupytergis/schema';
import { ChevronRightIcon, Eye, EyeOff, Search } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';
import { getFeatureIdentifier } from '../utils/getFeatureIdentifier';

interface IFeatureCardHeaderProps {
  feature: IIdentifiedFeature;
  featureTitle: string;
  isFloaterOpen: boolean;
  onToggleFloater: () => void;
  onHighlightFeature: (feature: IIdentifiedFeature) => void;
}

export const FeatureCardHeader: React.FC<IFeatureCardHeaderProps> = ({
  feature,
  featureTitle,
  isFloaterOpen,
  onToggleFloater,
  onHighlightFeature,
}) => {
  const featureIdentifier = getFeatureIdentifier(feature);
  const isRasterFeature =
    !feature.geometry &&
    !feature._geometry &&
    typeof feature?.x !== 'number' &&
    typeof feature?.y !== 'number';

  return (
    <div className="jgis-identify-card-header">
      <div className="jgis-identify-card-header-actions">
        <Button
          size="icon-sm"
          variant="icon"
          className="jgis-rotate-90 jgis-bg-transparent"
        >
          <ChevronRightIcon />
        </Button>
        <span>{featureTitle}</span>
      </div>

      <div className="jgis-identify-card-header-actions">
        {featureIdentifier && (
          <Button
            size="icon-md"
            variant="icon"
            className="jgis-inline-icon"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFloater();
            }}
            title={isFloaterOpen ? 'Hide map floater' : 'Show map floater'}
          >
            {isFloaterOpen ? <EyeOff /> : <Eye />}
          </Button>
        )}

        <Button
          size="icon-md"
          variant="icon"
          className="jgis-inline-icon"
          onClick={e => {
            e.preventDefault();
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
          <Search />
        </Button>
      </div>
    </div>
  );
};
