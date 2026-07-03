import { MimeModel, type IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Widget } from '@lumino/widgets';
import React, { useLayoutEffect, useRef } from 'react';

const MARKDOWN_MIME = 'text/markdown';

export interface IRenderedStoryMarkdownProps {
  rendermime: IRenderMimeRegistry | null | undefined;
  source: string;
  /** Fires after rendermime (or plain fallback) has painted. */
  onRendered?: () => void;
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

/** Jupyter rendermime markdown output (shared by overlay and story editor). */
export function RenderedStoryMarkdown({
  rendermime,
  source,
  onRendered,
}: IRenderedStoryMarkdownProps): JSX.Element | null {
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
        console.error('Failed to render story markdown', error);
        disposeRenderer(renderer);
        return;
      }

      if (cancelled || renderer.isDisposed) {
        disposeRenderer(renderer);
        return;
      }

      renderer.addClass('jp-MarkdownOutput');
      requestAnimationFrame(() => {
        if (!cancelled && !renderer.isDisposed) {
          onRendered?.();
        }
      });
    };

    void run();

    return () => {
      cancelled = true;
      disposeRenderer(renderer);
    };
  }, [rendermime, source, onRendered]);

  useLayoutEffect(() => {
    if (rendermime || !source) {
      return;
    }

    onRendered?.();
  }, [rendermime, source, onRendered]);

  if (!source) {
    return null;
  }

  if (!rendermime) {
    return (
      <div className="jgis-story-stage-overlay-content">
        <div className="specta-article-host-widget specta-cell-content">
          <pre className="jgis-story-overlay-markdown-plain">{source}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="jgis-story-stage-overlay-content">
      <div className="specta-article-host-widget specta-cell-content">
        <div ref={hostRef} />
      </div>
    </div>
  );
}
