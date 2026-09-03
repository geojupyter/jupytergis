import React from 'react';

import { ButtonTw } from '@/src/shared/components/ButtonTw';

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
      <ButtonTw variant="outline" size="sm" onClick={onBack}>
        Back to editor
      </ButtonTw>

      <ButtonTw size={'sm'} onClick={onApply}>
        Apply view
      </ButtonTw>
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
    <ButtonTw size="sm" onClick={onBack}>
      Back to editor
    </ButtonTw>
  );
}
