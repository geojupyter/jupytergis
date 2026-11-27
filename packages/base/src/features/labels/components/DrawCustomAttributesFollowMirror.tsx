import type { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { followedState } from '@/src/features/follow';
import { FollowMirrorContext } from '@/src/features/follow/useFollowedState';
import {
  DRAW_CUSTOM_ATTRIBUTES_DIALOG_KIND,
  DrawCustomAttributesDialogContent,
} from '@/src/features/labels/components/DrawCustomAttributesDialog';
import { Dialog, DialogContent } from '@/src/shared/components/Dialog';

interface IDrawCustomAttributesFollowMirrorProps {
  model: IJupyterGISModel;
}

/**
 * Mirrors the custom attributes dialog of the collaborator we are following.
 *
 * It lives outside the draw controls because a follower does not have to be
 * drawing to watch someone who is, and it is read-only: the attributes it
 * shows belong to the leader.
 */
export function DrawCustomAttributesFollowMirror({
  model,
}: IDrawCustomAttributesFollowMirrorProps): JSX.Element | null {
  const [layerId, setLayerId] = useState<string | null>(null);

  useEffect(() => {
    const sync = (): void => {
      const followed = followedState(model)?.openDialog?.value;

      // Never cover a dialog the follower opened themselves.
      if (
        model.localState?.openDialog?.value ||
        followed?.kind !== DRAW_CUSTOM_ATTRIBUTES_DIALOG_KIND
      ) {
        setLayerId(null);
        return;
      }

      const followedLayerId = followed.params?.layerId as string | undefined;
      setLayerId(
        followedLayerId && model.getLayer(followedLayerId)
          ? followedLayerId
          : null,
      );
    };

    sync();
    model.openDialogChanged.connect(sync);
    model.remoteUserChanged.connect(sync);

    return () => {
      model.openDialogChanged.disconnect(sync);
      model.remoteUserChanged.disconnect(sync);
    };
  }, [model]);

  if (!layerId) {
    return null;
  }

  return (
    <FollowMirrorContext.Provider value={true}>
      <Dialog open onOpenChange={() => setLayerId(null)}>
        <DialogContent className="jgis-follow-mirror">
          <DrawCustomAttributesDialogContent
            model={model}
            layerId={layerId}
            readOnly
          />
        </DialogContent>
      </Dialog>
    </FollowMirrorContext.Provider>
  );
}
