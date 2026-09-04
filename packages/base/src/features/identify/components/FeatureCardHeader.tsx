import { IIdentifiedFeature } from '@jupytergis/schema';
import { ChevronRightIcon, Eye, EyeOff, Search } from 'lucide-react';
import React from 'react';

import { ButtonTw } from '@/src/shared/components/ButtonTw';
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
        <ButtonTw size="icon-xs" variant="ghost" className="jgis-rotate-90">
          <ChevronRightIcon />
        </ButtonTw>
        <span>{featureTitle}</span>
      </div>

      <div className="jgis-identify-card-header-actions">
        <div className="inline-flex gap-0">
          {featureIdentifier && (
            <ButtonTw
              size="icon-sm"
              variant="ghost"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFloater();
              }}
              title={isFloaterOpen ? 'Hide map floater' : 'Show map floater'}
            >
              {isFloaterOpen ? <EyeOff /> : <Eye />}
            </ButtonTw>
          )}

          <ButtonTw
            size="icon-sm"
            variant="ghost"
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
          </ButtonTw>
        </div>
      </div>
    </div>
  );
};
