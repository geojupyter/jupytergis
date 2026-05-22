import { MimeModel } from '@jupyterlab/rendermime';
import React, { useLayoutEffect, useRef } from 'react';
import { Widget } from '@lumino/widgets';

import { useStoryRenderMime } from '@/src/features/story/context/StoryRenderMimeContext';

const MARKDOWN_MIME = 'text/markdown';

export interface IStoryScrollDriveMarkdownProps {
  source: string;
}

function disposeRenderer(renderer: Widget): void {
  if (renderer.isDisposed) {
    return;
  }
  if (renderer.isAttached) {
    try {
      Widget.detach(renderer);
    } catch {
      // Host may already be gone when React unmounts the pane.
    }
  }
  renderer.dispose();
}

/**
 * List scroll-drive overlay markdown via JupyterLab rendermime.
 * Falls back to plain text when the registry is unavailable.
 */
export function StoryScrollDriveMarkdown({
  source,
}: IStoryScrollDriveMarkdownProps): JSX.Element | null {
  const rendermime = useStoryRenderMime();
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!rendermime || !host || !source) {
      return;
    }

    const registry = rendermime.clone();
    const renderer = registry.createRenderer(MARKDOWN_MIME);
    const model = new MimeModel({
      data: { [MARKDOWN_MIME]: source },
      trusted: false,
    });

    let cancelled = false;

    const run = async (): Promise<void> => {
      if (cancelled) {
        return;
      }

      Widget.attach(renderer, host);
      if (cancelled) {
        disposeRenderer(renderer);
        return;
      }

      try {
        await renderer.renderModel(model);
      } catch (error) {
        console.error('Failed to render story scroll-drive markdown', error);
        disposeRenderer(renderer);
        return;
      }

      if (cancelled || renderer.isDisposed) {
        disposeRenderer(renderer);
        return;
      }

      renderer.addClass('jp-MarkdownOutput');
    };

    void run();

    return () => {
      cancelled = true;
      disposeRenderer(renderer);
    };
  }, [rendermime, source]);

  if (!source) {
    return null;
  }

  if (!rendermime) {
    return (
      <pre className="jgis-story-scroll-drive-markdown-plain">{source}</pre>
    );
  }

  return <div ref={hostRef} className="jgis-story-scroll-drive-markdown-host" />;
}
