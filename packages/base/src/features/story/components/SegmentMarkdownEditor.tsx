import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';

type MarkdownEditorTab = 'write' | 'preview';

export interface ISegmentMarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  rows?: number;
  tall?: boolean;
  debounceMs?: number;
}

export function SegmentMarkdownEditor({
  value,
  onChange,
  rows = 6,
  tall = false,
  debounceMs = 300,
}: ISegmentMarkdownEditorProps): JSX.Element {
  const [tab, setTab] = useState<MarkdownEditorTab>('write');
  const [draft, setDraft] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleDraftChange = (nextValue: string): void => {
    setDraft(nextValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(nextValue);
    }, debounceMs);
  };

  const handleBlur = (): void => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

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
          className={`jgis-story-editor-markdown-textarea${
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
        <div className="jgis-story-editor-markdown-preview jgis-story-viewer-content">
          {draft.trim() ? (
            <Markdown>{draft}</Markdown>
          ) : (
            <p className="jgis-story-editor-markdown-preview-empty">
              Nothing to preview yet.
            </p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
