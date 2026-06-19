import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import { debounce } from '@/src/tools';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';

type MarkdownEditorTab = 'write' | 'preview';

const MARKDOWN_EDIT_DEBOUNCE_WAIT = 300;
export interface ISegmentMarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  rows?: number;
  tall?: boolean;
}

export function SegmentMarkdownEditor({
  value,
  onChange,
  rows = 6,
  tall = false,
}: ISegmentMarkdownEditorProps): JSX.Element {
  const [tab, setTab] = useState<MarkdownEditorTab>('write');
  const [draft, setDraft] = useState(value);

  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;
  const debouncedOnChange = useMemo(
    () =>
      debounce((nextValue: string) => {
        onChangeRef.current(nextValue);
      }, MARKDOWN_EDIT_DEBOUNCE_WAIT),
    [MARKDOWN_EDIT_DEBOUNCE_WAIT],
  );

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleDraftChange = (nextValue: string): void => {
    setDraft(nextValue);
    debouncedOnChange(nextValue);
  };

  const handleBlur = (): void => {
    if (draft !== value) {
      onChange(draft);
    }
  };

  return (
    <Tabs
      value={tab}
      onValueChange={nextTab => setTab(nextTab as MarkdownEditorTab)}
    >
      <TabsList
        className="jgis-story-editor-markdown-tabs"
        aria-label="Markdown editor"
      >
        <TabsTrigger className="jgis-underline-indicator" value="write">
          Write
        </TabsTrigger>
        <TabsTrigger className="jgis-underline-indicator" value="preview">
          Preview
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="write"
        className="jgis-story-editor-markdown-tab-content"
      >
        <textarea
          className={`jgis-story-editor-markdown jgis-story-editor-markdown-textarea${
            tall ? ' jgis-story-editor-markdown-textarea--tall' : ''
          }`}
          rows={rows}
          value={draft}
          onChange={event => handleDraftChange(event.target.value)}
          onBlur={handleBlur}
          aria-label="Markdown source"
        />
      </TabsContent>

      <TabsContent
        value="preview"
        className="jgis-story-editor-markdown-tab-content"
      >
        <div className="jgis-story-editor-markdown jgis-story-editor-markdown-preview jgis-story-viewer-content">
          {draft.trim() ? (
            <Markdown>{draft}</Markdown>
          ) : (
            <p className="jgis-story-editor-help">Nothing to preview yet.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
