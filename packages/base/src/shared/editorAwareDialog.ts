import { Dialog } from '@jupyterlab/apputils';

// Input types that are not text entry, where Enter may still submit.
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'image',
]);

/**
 * Whether the event target is a text field where `Enter` should edit the value
 * rather than submit the dialog (CodeMirror, textarea, contenteditable, or a
 * text-entry input).
 */
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    target.closest('.cm-editor') !== null
  ) {
    return true;
  }
  return (
    target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)
  );
}

/**
 * A `Dialog` that does not submit on `Enter` while a text editor is focused, so
 * expression/JSON editors can accept newlines. See geojupyter/jupytergis#1598.
 */
export class EditorAwareDialog<T> extends Dialog<T> {
  handleEvent(event: Event): void {
    if (
      event.type === 'keydown' &&
      (event as KeyboardEvent).key === 'Enter' &&
      isTextEntryTarget(event.target)
    ) {
      // Let the editor handle Enter instead of resolving the dialog.
      return;
    }
    super.handleEvent(event);
  }
}
