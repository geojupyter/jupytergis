import { IIdentifiedFeature } from '@jupytergis/schema';
import { Eye, EyeOff, Search } from 'lucide-react';
import React from 'react';

import { ButtonTw } from '@/src/shared/components/ButtonTw';
import { CollapsibleHeader } from '@/src/shared/components/Collapsible';
import { getFeatureIdentifier } from '../utils/getFeatureIdentifier';

interface IFeatureCardHeaderProps extends React.ComponentPropsWithoutRef<'div'> {
  feature: IIdentifiedFeature;
  featureTitle: string;
  isFloaterOpen: boolean;
  onToggleFloater: () => void;
  onHighlightFeature: (feature: IIdentifiedFeature) => void;
}

export const FeatureCardHeader = React.forwardRef<
  HTMLDivElement,
  IFeatureCardHeaderProps
>(function FeatureCardHeader(
  {
    feature,
    featureTitle,
    isFloaterOpen,
    onToggleFloater,
    onHighlightFeature,
    className,
    ...props
  },
  ref,
) {
  const featureIdentifier = getFeatureIdentifier(feature);
  const isRasterFeature =
    !feature.geometry &&
    !feature._geometry &&
    typeof feature?.x !== 'number' &&
    typeof feature?.y !== 'number';

  return (
    <CollapsibleHeader
      ref={ref}
      title={featureTitle}
      className={className}
      actions={
        <>
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
        </>
      }
      {...props}
    />
  );
});
