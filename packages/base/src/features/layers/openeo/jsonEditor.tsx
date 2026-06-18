import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import * as React from 'react';

export interface IJsonEditorProps {
  /** Stable serialized initial value. Changes reset the editor. */
  value: string;
  onChange: (value: string) => void;
  parseError?: string | null;
}

export const JsonEditor: React.FC<IJsonEditorProps> = ({
  value,
  onChange,
  parseError,
}) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  // Latest onChange held in a ref so the editor doesn't get rebuilt on
  // every parent render.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        indentOnInput(),
        json(),
        keymap.of([...defaultKeymap, ...historyKeymap] as any),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '12px' },
          '.cm-scroller': { fontFamily: 'var(--jp-code-font-family)' },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // We only initialize on mount; subsequent value changes flow through
    // the next effect below.
  }, []);

  // Push external value changes into the editor only when they actually
  // differ from the current doc (avoids clobbering the user's cursor).
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div className="jp-openeo-json-editor">
      <div ref={hostRef} className="jp-openeo-json-editor-host" />
      {parseError && (
        <div className="jp-openeo-json-editor-error">{parseError}</div>
      )}
    </div>
  );
};
