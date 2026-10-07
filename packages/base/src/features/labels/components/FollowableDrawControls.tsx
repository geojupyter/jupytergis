import type { IDrawSessionState, IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { followedState } from '@/src/features/follow';
import { VectorDrawControls } from '@/src/features/labels/components/VectorDrawControls';

interface IFollowableDrawControlsProps {
  model: IJupyterGISModel;
  isDrawing: boolean;
  drawGeometryLabel: string | undefined;
  drawLayerId: string | undefined;
  onDrawGeometryTypeChange: (geometryType: string) => void;
}

/**
 * The draw controls, plus a read-only copy of the ones the collaborator we
 * follow is using.
 *
 * Drawing is a local mode, so a follower never enters it; they are shown the
 * same bar with the leader's armed tool, and cannot click it.
 */
export function FollowableDrawControls({
  model,
  isDrawing,
  drawGeometryLabel,
  drawLayerId,
  onDrawGeometryTypeChange,
}: IFollowableDrawControlsProps): JSX.Element | null {
  const [followedDraw, setFollowedDraw] = useState<IDrawSessionState | null>(
    null,
  );
  const [followColor, setFollowColor] = useState<string | undefined>();

  useEffect(() => {
    const emitter = model.getClientId().toString();

    if (isDrawing && drawLayerId) {
      model.syncDrawSession(
        { layerId: drawLayerId, geometry: drawGeometryLabel },
        emitter,
      );
    } else if (model.localState?.drawSession?.value) {
      model.syncDrawSession(null, emitter);
    }
  }, [model, isDrawing, drawLayerId, drawGeometryLabel]);

  useEffect(() => {
    const sync = (): void => {
      const followed = followedState(model);
      const session = followed?.drawSession?.value ?? null;
      setFollowedDraw(
        session && model.getLayer(session.layerId) ? session : null,
      );
      setFollowColor(followed?.user?.color);
    };

    sync();
    model.drawSessionChanged.connect(sync);
    model.remoteUserChanged.connect(sync);

    return () => {
      model.drawSessionChanged.disconnect(sync);
      model.remoteUserChanged.disconnect(sync);
    };
  }, [model]);

  if (isDrawing) {
    return (
      <VectorDrawControls
        drawGeometryLabel={drawGeometryLabel}
        onDrawGeometryTypeChange={onDrawGeometryTypeChange}
        model={model}
        drawLayerId={drawLayerId}
      />
    );
  }

  if (!followedDraw) {
    return null;
  }

  return (
    <VectorDrawControls
      drawGeometryLabel={followedDraw.geometry}
      onDrawGeometryTypeChange={() => undefined}
      model={model}
      drawLayerId={followedDraw.layerId}
      readOnly
      followColor={followColor}
    />
  );
}
