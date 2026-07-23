import React from 'react';

import { Button } from '@/src/shared/components/Button';

export interface IMapViewBarActionsProps {
  onBack: () => void;
  onApply: () => void;
}

export function MapViewBarActions({
  onBack,
  onApply,
}: IMapViewBarActionsProps): JSX.Element {
  return (
    <>
      <Button variant="outline" size="sm" onClick={onBack}>
        Back to editor
      </Button>
      <Button
        size="sm"
        className="jp-mod-styled jp-mod-accept"
        onClick={onApply}
      >
        Apply view
      </Button>
    </>
  );
}

export interface IMapPreviewBarActionsProps {
  onBack: () => void;
}

export function MapPreviewBarActions({
  onBack,
}: IMapPreviewBarActionsProps): JSX.Element {
  return (
    <Button size="sm" onClick={onBack}>
      Back to editor
    </Button>
  );
}
