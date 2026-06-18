import React from 'react';

import { Button } from '@/src/shared/components/Button';

export interface IMapPickBarActionsProps {
  onBack: () => void;
  onApply: () => void;
}

export function MapPickBarActions({
  onBack,
  onApply,
}: IMapPickBarActionsProps): JSX.Element {
  return (
    <>
      <Button variant="outline" size="sm" onClick={onBack}>
        Back to editor
      </Button>
      <Button size="sm" onClick={onApply}>
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
