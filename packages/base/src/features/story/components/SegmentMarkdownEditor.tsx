import type { IJupyterGISModel } from '@jupytergis/schema';
import { type IEditorServices, CodeEditor } from '@jupyterlab/codeeditor';
import type { CodeMirrorEditor } from '@jupyterlab/codemirror';
import type { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React, { useEffect, useRef, useState } from 'react';

import { RenderedStoryMarkdown } from '@/src/features/story/components/RenderedStoryMarkdown';
import { getStorySegmentMarkdownSharedModel } from '@/src/features/story/utils/storySegmentMarkdownSharedModel';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';

type MarkdownEditorTab = 'write' | 'preview';

export interface ISegmentMarkdownEditorProps {
  model: IJupyterGISModel;
  segmentId: string;
  editorServices: IEditorServices;
  rendermime: IRenderMimeRegistry;
  initialMarkdown?: string;
  rows?: number;
  tall?: boolean;
}

function markdownEditorMinHeight(rows: number, tall: boolean): string {
  if (tall) {
    return '10rem';
  }
  return `${Math.max(rows, 4) * 1.25}rem`;
}

export function SegmentMarkdownEditor({
  model,
  segmentId,
  editorServices,
  rendermime,
  initialMarkdown = '',
  rows = 6,
  tall = false,
}: ISegmentMarkdownEditorProps): JSX.Element {
  const [tab, setTab] = useState<MarkdownEditorTab>('write');
  const [previewMarkdown, setPreviewMarkdown] = useState(initialMarkdown);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CodeMirrorEditor | null>(null);
  const codeModelRef = useRef<CodeEditor.Model | null>(null);
  const seedMarkdownRef = useRef({ segmentId, markdown: initialMarkdown });

  if (seedMarkdownRef.current.segmentId !== segmentId) {
    seedMarkdownRef.current = { segmentId, markdown: initialMarkdown };
  }

  const minHeight = markdownEditorMinHeight(rows, tall);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const sharedModel = getStorySegmentMarkdownSharedModel(
      model,
      segmentId,
      seedMarkdownRef.current.markdown,
    );
    const codeModel = new CodeEditor.Model({
      sharedModel: sharedModel as import('@jupyter/ydoc').IYText,
      mimeType: 'text/markdown',
    });
    codeModelRef.current = codeModel;

    const editor = editorServices.factoryService.newInlineEditor({
      host,
      model: codeModel,
      config: {
        lineNumbers: true,
        lineWrap: true,
      },
    }) as CodeMirrorEditor;
    editorRef.current = editor;

    const refreshPreview = (): void => {
      setPreviewMarkdown(sharedModel.getSource());
    };

    sharedModel.changed.connect(refreshPreview);
    refreshPreview();

    host.style.minHeight = minHeight;

    return () => {
      sharedModel.changed.disconnect(refreshPreview);
      editor.dispose();
      editorRef.current = null;
      codeModel.dispose();
      codeModelRef.current = null;
    };
  }, [model, segmentId, editorServices, minHeight]);

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
        forceMount
        className="jgis-story-editor-markdown-tab-content"
      >
        <div
          className={`jgis-story-editor-markdown jgis-story-editor-markdown-host jp-CodeMirrorEditor${
            tall ? ' jgis-story-editor-markdown-host--tall' : ''
          }`}
        >
          <div
            ref={hostRef}
            className="jgis-story-editor-markdown-editor"
            aria-label="Markdown source"
          />
        </div>
      </TabsContent>

      <TabsContent
        value="preview"
        className="jgis-story-editor-markdown-tab-content"
      >
        <div className="jgis-story-editor-markdown jgis-story-editor-markdown-preview jgis-story-viewer-content">
          {previewMarkdown.trim() ? (
            <RenderedStoryMarkdown
              rendermime={rendermime}
              source={previewMarkdown}
            />
          ) : (
            <p className="jgis-story-editor-help">Nothing to preview yet.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
