import { Button } from '@/src/shared/components/Button';
import { ChevronRightIcon, Eye, EyeOff, Search } from 'lucide-react';
import React from 'react';

interface IFeatureCardHeaderProps {
  feature: any;
  featureTitle: string;
  isOpen: boolean;
  onToggleFloater: (feature: any) => void;
  onHighlightFeature: (feature: any) => void;
}

export const FeatureCardHeader: React.FC<IFeatureCardHeaderProps> = ({
  feature,
  featureTitle,
  isOpen,
  onToggleFloater,
  onHighlightFeature,
}) => {
  const isRasterFeature =
    !feature.geometry &&
    !feature._geometry &&
    typeof feature?.x !== 'number' &&
    typeof feature?.y !== 'number';

  return (
    <div className="identify-v2-card-header">
      <div className="jgis-symbology-override-collapsible-trigger">
        <Button
          size="icon-sm"
          variant="icon"
          className="jgis-rotate-90 jgis-bg-transparent"
        >
          <ChevronRightIcon />
        </Button>
        <span>{featureTitle}</span>
      </div>

      <Button
        size="icon-md"
        variant="icon"
        className="jgis-inline-icon"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFloater(feature);
        }}
        title={feature?.floaterOpen ? 'Hide map floater' : 'Show map floater'}
      >
        {feature?.floaterOpen ? <EyeOff /> : <Eye />}
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
  );
};
