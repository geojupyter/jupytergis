import type { IJupyterGISModel } from '@jupytergis/schema';
import { jupyterHighlightStyle } from '@jupyterlab/codemirror';
import { MimeModel } from '@jupyterlab/rendermime';
import { Widget } from '@lumino/widgets';
import React, { memo, useLayoutEffect, useRef } from 'react';
import { StyleModule } from 'style-mod';

import { useStoryRenderMime } from '@/src/features/story/components/StoryRenderMime';

const MARKDOWN_MIME = 'text/markdown';

export type StoryRenderedMarkdownVariant = 'overlay' | 'column';

const ROOT_CLASS: Record<StoryRenderedMarkdownVariant, string> = {
  overlay: 'jgis-story-stage-overlay-content',
  column: 'jgis-story-viewer-content',
};

export interface IRenderedStoryMarkdownProps {
  model: IJupyterGISModel;
  segmentId: string;
  source: string;
  /** Fires after rendermime has painted. */
  onRendered?: () => void;
  variant?: StoryRenderedMarkdownVariant;
}

function disposeRenderer(renderer: Widget): void {
  if (renderer.isDisposed) {
    return;
  }

  // React may have already removed the host, leaving Lumino's isAttached
  // true while node.isConnected is false. Widget.detach()/dispose() throw
  // in that state — clear the flag so dispose can finish cleanly.
  try {
    if (renderer.isAttached && renderer.node.isConnected) {
      Widget.detach(renderer);
    } else if (renderer.isAttached) {
      renderer.clearFlag(Widget.Flag.IsAttached);
    }
  } catch {
    if (renderer.isAttached) {
      renderer.clearFlag(Widget.Flag.IsAttached);
    }
  }

  renderer.dispose();
}

function renderedStoryMarkdownPropsAreEqual(
  prev: IRenderedStoryMarkdownProps,
  next: IRenderedStoryMarkdownProps,
): boolean {
  return (
    prev.model === next.model &&
    prev.segmentId === next.segmentId &&
    prev.source === next.source &&
    prev.variant === next.variant
  );
}

let highlightStyleMounted = false;

export function ensureJupyterHighlightStyle(): void {
  if (!highlightStyleMounted) {
    StyleModule.mount(document, jupyterHighlightStyle.module as StyleModule);
    highlightStyleMounted = true;
  }
}

/** Jupyter rendermime markdown output (shared by overlay and story editor). */
export const RenderedStoryMarkdown = memo(
  ({
    model,
    segmentId,
    source,
    onRendered,
    variant = 'overlay',
  }: IRenderedStoryMarkdownProps): JSX.Element | null => {
    const rendermime = useStoryRenderMime(model, segmentId);
    const hostRef = useRef<HTMLDivElement>(null);
    const onRenderedRef = useRef(onRendered);
    onRenderedRef.current = onRendered;

    useLayoutEffect(() => {
      const host = hostRef.current;
      if (!host || !source) {
        return;
      }

      ensureJupyterHighlightStyle();

      const registry = rendermime.clone();
      const renderer = registry.createRenderer(MARKDOWN_MIME);
      const mimeModel = new MimeModel({
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
          await renderer.renderModel(mimeModel);
        } catch (error) {
          // URL resolve can throw on missing local images (Specta contents
          // manager). Jupyter already painted the markdown so don't dispose.
          console.warn('Story markdown rendered with errors', error);
        }

        if (cancelled || renderer.isDisposed) {
          disposeRenderer(renderer);
          return;
        }

        renderer.addClass('jp-MarkdownOutput');
        requestAnimationFrame(() => {
          if (!cancelled && !renderer.isDisposed) {
            onRenderedRef.current?.();
          }
        });
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

    return (
      <div className={`jgis-story-rendered-markdown ${ROOT_CLASS[variant]}`}>
        <div
          ref={hostRef}
          className="specta-article-host-widget specta-cell-content"
        ></div>
      </div>
    );
  },
  renderedStoryMarkdownPropsAreEqual,
);
