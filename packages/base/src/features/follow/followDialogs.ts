import { faArrowPointer } from '@fortawesome/free-solid-svg-icons';
import {
  FollowDialogKind,
  IDict,
  IJupyterGISModel,
  IOpenDialogState,
} from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { User } from '@jupyterlab/services';
import { IDisposable } from '@lumino/disposable';

import { followedState, hasFollowers } from './useFollowedState';

export type FollowDialogFactory = (
  model: IJupyterGISModel,
  params: IDict,
) => Dialog<any> | null;

const factories = new Map<FollowDialogKind, FollowDialogFactory>();

export function registerFollowDialog(
  kind: FollowDialogKind,
  factory: FollowDialogFactory,
): void {
  factories.set(kind, factory);
}

let launchToken = 0;

/**
 * Launch a dialog while telling everyone following us that it is open, so they
 * can mirror it. The descriptor carries ids only: the follower rebuilds the
 * dialog from its own services rather than receiving one.
 */
export async function launchFollowable<T>(
  model: IJupyterGISModel,
  descriptor: IOpenDialogState,
  dialog: Dialog<T>,
): Promise<Dialog.IResult<T>> {
  const token = ++launchToken;
  const emitter = model.getClientId().toString();

  model.syncOpenDialog(descriptor, emitter);
  const stopSharingView = shareDialogView(model, dialog, descriptor.kind);

  try {
    return await dialog.launch();
  } finally {
    stopSharingView();
    // A newer launch already owns the field, so clearing it would hide a
    // dialog that is still open.
    if (token === launchToken) {
      model.syncOpenDialog(null, emitter);
      model.syncDialogState(null, emitter);
    }
  }
}

/**
 * Events swallowed inside a mirrored dialog's body.
 *
 * Hiding the accept buttons is not enough on its own: the layer browser adds a
 * layer straight from a tile's `onClick`, so a follower clicking around in the
 * mirror would write to the shared document.
 *
 * The listener is scoped to the body, and the dialog's own handlers are
 * registered on its root node in the capture phase, so Escape and the
 * header's close button keep working. Wheel and scroll events are left alone
 * so a follower can still read a long form.
 */
const BLOCKED_EVENTS = [
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'keydown',
  'keypress',
  'change',
  'input',
  'submit',
  'paste',
  'drop',
];

function makeReadOnly(dialog: Dialog<any>): void {
  const body = dialog.node.querySelector('.jp-Dialog-body');
  if (!body) {
    return;
  }

  const block = (event: Event) => {
    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  BLOCKED_EVENTS.forEach(name => body.addEventListener(name, block, true));
}

const POINTER_INTERVAL = 33;
const SCROLL_INTERVAL = 60;

/**
 * Run at most once per interval, but always run once more after the last call.
 *
 * `tools.ts` has a `throttle`, but under continuous movement it cancels and
 * reschedules on every event, so it only ever fires once the pointer stops.
 * A cursor needs the steady stream, and the trailing call so it lands where
 * the mouse actually stopped.
 */
function throttled<T extends (...args: any[]) => void>(
  callback: T,
  interval: number,
): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: any[] | null = null;

  const run = (args: any[]) => {
    last = Date.now();
    pending = null;
    callback(...args);
  };

  return ((...args: any[]) => {
    pending = args;
    const remaining = interval - (Date.now() - last);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      run(args);
      return;
    }

    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (pending) {
          run(pending);
        }
      }, remaining);
    }
  }) as T;
}

function dialogContent(dialog: Dialog<any>): HTMLElement | null {
  return dialog.node.querySelector('.jp-Dialog-content');
}

/**
 * Where a node sits under the dialog, as the chain of child indices leading to
 * it. Both clients build the same dialog from the same document, so the same
 * path picks out the same pane on either side.
 */
function domPath(root: Element, node: Element): string | null {
  const parts: number[] = [];
  let current: Element | null = node;

  while (current && current !== root) {
    const parent: Element | null = current.parentElement;
    if (!parent) {
      return null;
    }
    parts.unshift(Array.prototype.indexOf.call(parent.children, current));
    current = parent;
  }

  return current === root ? parts.join('.') : null;
}

function nodeAtPath(root: Element, path: string): Element | null {
  let current: Element | null = root;

  for (const part of path.split('.')) {
    current = current?.children[Number(part)] ?? null;
  }

  return current;
}

/**
 * Share where our mouse is inside the dialog and how far its panes are
 * scrolled, so a follower sees both.
 */
function shareDialogView(
  model: IJupyterGISModel,
  dialog: Dialog<any>,
  kind: FollowDialogKind,
): () => void {
  const content = dialogContent(dialog);
  if (!content) {
    return () => undefined;
  }

  const emitter = model.getClientId().toString();
  model.syncDialogView({ kind }, emitter);

  const onMove = throttled((event: MouseEvent) => {
    if (!hasFollowers(model)) {
      return;
    }

    const rect = content.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    model.updateDialogView(
      {
        pointer: {
          x: (event.clientX - rect.left) / rect.width,
          y: (event.clientY - rect.top) / rect.height,
        },
      },
      emitter,
    );
  }, POINTER_INTERVAL);

  const onScroll = throttled((event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !hasFollowers(model)) {
      return;
    }

    const path = domPath(content, target);
    const range = target.scrollHeight - target.clientHeight;
    if (path === null || range <= 0) {
      return;
    }

    model.updateDialogView(
      {
        scroll: {
          ...(model.localState?.dialogView?.value?.scroll ?? {}),
          [path]: target.scrollTop / range,
        },
      },
      emitter,
    );
  }, SCROLL_INTERVAL);

  dialog.node.addEventListener('mousemove', onMove);
  // Scroll does not bubble, so it has to be caught on the way down.
  dialog.node.addEventListener('scroll', onScroll, true);

  return () => {
    dialog.node.removeEventListener('mousemove', onMove);
    dialog.node.removeEventListener('scroll', onScroll, true);
    model.syncDialogView(null, emitter);
  };
}

/**
 * The same cursor the collaborator pointers on the map draw, built by hand
 * because the mirror is not a React tree.
 */
function pointerElement(user: User.IIdentity | undefined): HTMLElement {
  const color = user?.color ?? 'var(--jp-brand-color1)';
  const name = user?.display_name ?? user?.name ?? '';
  const [width, height, , , path] = faArrowPointer.icon;

  const wrapper = document.createElement('div');
  wrapper.className = 'jGIS-Popup-Wrapper jgis-follow-pointer';

  const pointer = document.createElement('div');
  pointer.className = 'jGIS-Remote-Pointer';
  pointer.style.color = color;

  pointer.innerHTML =
    `<svg class="jGIS-Remote-Pointer-Icon" viewBox="0 0 ${width} ${height}">` +
    `<path d="${path}"/></svg>`;

  const label = document.createElement('div');
  label.className = 'jGIS-Remote-Pointer-Label';
  label.style.borderColor = color;

  const avatar = document.createElement('div');
  avatar.className = 'jGIS-Remote-Pointer-Avatar';
  avatar.title = name;

  if (user?.avatar_url) {
    const image = document.createElement('img');
    image.src = user.avatar_url;
    image.alt = '';
    // Fall back to the initials if the avatar cannot be loaded, the same way
    // the map pointers do.
    image.addEventListener('error', () => {
      image.remove();
      avatar.style.backgroundColor = color;
      avatar.textContent = user.initials ?? '';
    });
    avatar.append(image);
  } else {
    avatar.style.backgroundColor = color;
    avatar.textContent = user?.initials ?? '';
  }

  const text = document.createElement('span');
  text.className = 'jGIS-Remote-Pointer-Name';
  text.textContent = name;

  label.append(avatar, text);
  pointer.append(label);
  wrapper.append(pointer);

  return wrapper;
}

/**
 * Draw the followed collaborator's mouse inside a mirrored dialog, and keep
 * its panes scrolled where theirs are.
 */
function mirrorDialogView(
  model: IJupyterGISModel,
  dialog: Dialog<any>,
): () => void {
  const content = dialogContent(dialog);
  if (!content) {
    return () => undefined;
  }

  const cursor = pointerElement(followedState(model)?.user);
  cursor.style.display = 'none';

  // `.jp-Dialog-content` is `overflow: hidden`, which clips the name label as
  // soon as the collaborator's mouse nears an edge. The cursor lives on the
  // dialog's full-screen container instead, positioned in pixels off the
  // content box.
  dialog.node.append(cursor);

  // Awareness fires for every client, so only touch the DOM when what we draw
  // has actually moved.
  let lastPointer = '';
  let lastScroll = '';

  const update = () => {
    const view = followedState(model)?.dialogView?.value;

    const point = view?.pointer;
    const pointerKey = point ? `${point.x},${point.y}` : '';
    if (pointerKey !== lastPointer) {
      lastPointer = pointerKey;
      if (point) {
        const rect = content.getBoundingClientRect();
        cursor.style.display = '';
        cursor.style.left = `${rect.left + point.x * rect.width}px`;
        cursor.style.top = `${rect.top + point.y * rect.height}px`;
      } else {
        cursor.style.display = 'none';
      }
    }

    const scroll = view?.scroll;
    const scrollKey = scroll ? JSON.stringify(scroll) : '';
    if (scrollKey === lastScroll) {
      return;
    }
    lastScroll = scrollKey;

    for (const [path, ratio] of Object.entries(scroll ?? {})) {
      const pane = nodeAtPath(content, path);
      if (!(pane instanceof HTMLElement)) {
        continue;
      }
      const range = pane.scrollHeight - pane.clientHeight;
      if (range > 0) {
        pane.scrollTop = ratio * range;
      }
    }
  };

  update();
  model.dialogViewChanged.connect(update);

  return () => {
    model.dialogViewChanged.disconnect(update);
    cursor.remove();
  };
}

function descriptorKey(descriptor: IOpenDialogState | null): string | null {
  if (!descriptor) {
    return null;
  }
  return `${descriptor.kind}:${JSON.stringify(descriptor.params ?? {})}`;
}

/**
 * Mirrors the dialogs opened by the user we are following.
 *
 * The mirror is built locally from the shared document, never sent by the
 * leader, and is read-only: its accept buttons are hidden so a follower can
 * never submit someone else's form.
 */
export class FollowDialogMirror implements IDisposable {
  constructor(model: IJupyterGISModel) {
    this._model = model;
    this._model.openDialogChanged.connect(this._sync, this);
    this._model.remoteUserChanged.connect(this._sync, this);
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._model.openDialogChanged.disconnect(this._sync, this);
    this._model.remoteUserChanged.disconnect(this._sync, this);
    this._close();
  }

  private _sync(): void {
    const remoteUser = this._model.localState?.remoteUser;

    const descriptor = remoteUser
      ? (followedState(this._model)?.openDialog?.value ?? null)
      : null;

    const key = descriptorKey(descriptor);
    if (key === this._currentKey) {
      return;
    }

    const previous = this._mirror;
    this._close();
    this._currentKey = key;

    if (!descriptor) {
      return;
    }

    // Never steal a dialog the follower opened themselves. The mirror we just
    // closed can still be the tracker's current widget for a tick, so it does
    // not count.
    const open = Dialog.tracker.currentWidget;
    if (open && open !== previous) {
      return;
    }

    const factory = factories.get(descriptor.kind);
    if (!factory) {
      return;
    }

    let dialog: Dialog<any> | null = null;
    try {
      dialog = factory(this._model, descriptor.params ?? {});
    } catch (error) {
      console.warn(`Could not mirror the ${descriptor.kind} dialog`, error);
    }

    if (!dialog) {
      return;
    }

    dialog.addClass('jgis-follow-mirror');
    makeReadOnly(dialog);
    this._mirror = dialog;
    this._stopMirroringView = mirrorDialogView(this._model, dialog);

    // A dismissed mirror stays dismissed: only the leader's next change
    // reopens one.
    dialog.launch().catch(() => undefined);
  }

  private _close(): void {
    this._stopMirroringView?.();
    this._stopMirroringView = null;

    const mirror = this._mirror;
    this._mirror = null;
    if (mirror && !mirror.isDisposed) {
      mirror.reject();
    }
  }

  private _model: IJupyterGISModel;
  private _mirror: Dialog<any> | null = null;
  private _stopMirroringView: (() => void) | null = null;
  private _currentKey: string | null = null;
  private _isDisposed = false;
}
