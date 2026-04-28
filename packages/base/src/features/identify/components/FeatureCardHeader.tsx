import { Button } from '@/src/shared/components/Button';
import { ChevronRightIcon, Eye, EyeOff, Search } from 'lucide-react';
import React from 'react';

interface IFeatureCardHeaderProps {
  feature: any;
  featureTitle: string;
  isFloaterOpen: boolean;
  onToggleFloater: () => void;
  onHighlightFeature: (feature: any) => void;
}

export const FeatureCardHeader: React.FC<IFeatureCardHeaderProps> = ({
  feature,
  featureTitle,
  isFloaterOpen,
  onToggleFloater,
  onHighlightFeature,
}) => {
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
