import { IJupyterGISClientState, IJupyterGISModel } from '@jupytergis/schema';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * True inside a dialog that mirrors the collaborator we are following. The
 * mirrored dialog reads its state off awareness instead of owning it, and
 * never broadcasts.
 */
export const FollowMirrorContext = createContext(false);

function useIsFollowMirror(): boolean {
  return useContext(FollowMirrorContext);
}

/**
 * Awareness is broadcast to every client on every change, so a keystroke must
 * not become a message.
 */
const BROADCAST_INTERVAL = 150;

function dialogStateKey(kind: string, key: string): string {
  return `${kind}:${key}`;
}

function clientStates(
  model: IJupyterGISModel,
): Map<number, IJupyterGISClientState> {
  return model.sharedModel.awareness.getStates() as Map<
    number,
    IJupyterGISClientState
  >;
}

/**
 * Scope the key to the dialog it belongs to.
 *
 * `useSchemaFormState` backs the left panel's property form as well as the
 * dialogs, and those share a schema title. Without the dialog in the key the
 * panel would broadcast over the dialog a follower is watching.
 */
function scopedKey(
  state: IJupyterGISClientState | undefined,
  key: string,
): string | null {
  const kind = state?.openDialog?.value?.kind;
  return kind ? dialogStateKey(kind, key) : null;
}

/**
 * The state of the collaborator we are following, if any.
 */
export function followedState(
  model: IJupyterGISModel,
): IJupyterGISClientState | undefined {
  const remoteUser = model.localState?.remoteUser;
  return remoteUser ? clientStates(model).get(remoteUser) : undefined;
}

export function hasFollowers(model: IJupyterGISModel): boolean {
  const clientId = model.getClientId();
  for (const [, state] of clientStates(model)) {
    if (state?.remoteUser === clientId) {
      return true;
    }
  }
  return false;
}

/**
 * Share one piece of a dialog's React state with whoever is following us, or,
 * in a mirrored dialog, take that piece from the collaborator we follow.
 *
 * The same call does both, so a dialog body does not need to know which side
 * of follow mode it is rendering on.
 */
export function useFollowedState<T>(
  model: IJupyterGISModel,
  key: string,
  value: T,
  apply: (value: T) => void,
): void {
  const isMirror = useIsFollowMirror();
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!isMirror) {
      return;
    }

    const onChange = () => {
      const remoteUser = model.localState?.remoteUser;
      if (!remoteUser) {
        return;
      }

      const state = clientStates(model).get(remoteUser);
      const followedKey = scopedKey(state, key);
      if (!followedKey) {
        return;
      }

      const followed = state?.dialogState?.value?.[followedKey];
      if (followed !== undefined) {
        applyRef.current(followed as T);
      }
    };

    onChange();
    model.dialogStateChanged.connect(onChange);
    model.remoteUserChanged.connect(onChange);

    return () => {
      model.dialogStateChanged.disconnect(onChange);
      model.remoteUserChanged.disconnect(onChange);
    };
  }, [model, key, isMirror]);

  const pending = useRef<T>(value);
  pending.current = value;

  useEffect(() => {
    if (isMirror) {
      return;
    }

    const timer = setTimeout(() => {
      // Only while a dialog is open, and only when somebody is watching: this
      // hook sits under every form in the app.
      const localKey = scopedKey(model.localState ?? undefined, key);
      if (!localKey || !hasFollowers(model)) {
        return;
      }

      model.setDialogStateKey(
        localKey,
        pending.current,
        model.getClientId().toString(),
      );
    }, BROADCAST_INTERVAL);

    return () => clearTimeout(timer);
  }, [model, key, isMirror, value]);
}

/**
 * Track which form field has focus, and paint the collaborator's focus in a
 * mirrored dialog.
 *
 * Returns the handlers to hand to rjsf. On a mirror they do nothing: the form
 * cannot be focused there anyway.
 */
export function useFollowedFocus(
  model: IJupyterGISModel,
  containerRef: React.RefObject<HTMLElement | null>,
): { onFocus: (id: string) => void; onBlur: (id: string) => void } {
  const isMirror = useIsFollowMirror();
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useFollowedState(model, 'focus', focusedId, setFocusedId);

  useEffect(() => {
    if (!isMirror || !focusedId) {
      return;
    }

    const container = containerRef.current;
    const field = container?.querySelector(`#${CSS.escape(focusedId)}`);
    if (!(field instanceof HTMLElement)) {
      return;
    }

    const user = followedState(model)?.user;
    const target = field.closest<HTMLElement>('.form-group') ?? field;
    target.classList.add('jgis-follow-focus');
    target.style.setProperty(
      '--jgis-follow-color',
      user?.color ?? 'var(--jp-brand-color1)',
    );
    field.scrollIntoView({ block: 'nearest' });

    return () => {
      target.classList.remove('jgis-follow-focus');
      target.style.removeProperty('--jgis-follow-color');
    };
  }, [model, containerRef, isMirror, focusedId]);

  return {
    onFocus: (id: string) => {
      if (!isMirror) {
        setFocusedId(id);
      }
    },
    onBlur: (id: string) => {
      if (!isMirror) {
        setFocusedId(current => (current === id ? null : current));
      }
    },
  };
}
