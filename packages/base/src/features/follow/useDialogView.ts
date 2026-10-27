import type { FollowDialogKind, IJupyterGISModel } from '@jupytergis/schema';
import { useContext, useEffect } from 'react';

import {
  mirrorDialogViewOn,
  shareDialogViewOn,
} from '@/src/features/follow/followDialogs';
import { FollowMirrorContext } from '@/src/features/follow/useFollowedState';

/**
 * Share our mouse inside a React dialog with whoever follows us, or, in a
 * mirrored one, draw the mouse of the collaborator we follow.
 *
 * The lumino dialogs get this from `launchFollowable`; a dialog that is only a
 * React tree has to ask for it, pointing at the box its body renders in.
 */
export function useDialogView(
  model: IJupyterGISModel,
  bodyRef: React.RefObject<HTMLElement | null>,
  kind: FollowDialogKind,
): void {
  const isMirror = useContext(FollowMirrorContext);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    // The popup holds the header and the close button too, so it is the box
    // the mouse moves in and the one the cursor is positioned against.
    const root =
      body.closest<HTMLElement>('[data-slot="dialog-content"]') ?? body;
    const boxes = { root, content: root };

    return isMirror
      ? mirrorDialogViewOn(model, boxes)
      : shareDialogViewOn(model, boxes, kind);
  }, [model, bodyRef, kind, isMirror]);
}
