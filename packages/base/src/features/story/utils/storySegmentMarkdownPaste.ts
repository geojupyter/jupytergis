import type { IJupyterGISModel } from '@jupytergis/schema';
import { URLExt } from '@jupyterlab/coreutils';
import type * as nbformat from '@jupyterlab/nbformat';
import { imageRendererFactory } from '@jupyterlab/rendermime';

import {
  formatSegmentAttachmentMarkdown,
  generateSegmentAttachmentUri,
  setSegmentAttachment,
} from '@/src/features/story/utils/storySegmentAttachments';

interface IStorySegmentMarkdownPasteOptions {
  model: IJupyterGISModel;
  segmentId: string;
  insertMarkdown: (markdown: string) => void;
}

/**
 * Paste image clipboard items as segment attachments (notebook-style).
 * Returns true when an image paste was handled.
 */
export function handleStorySegmentMarkdownPaste(
  event: ClipboardEvent,
  options: IStorySegmentMarkdownPasteOptions,
): boolean {
  const { clipboardData } = event;
  if (!clipboardData) {
    return false;
  }

  let handledImage = false;

  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i];
    if (item.kind !== 'file') {
      continue;
    }

    const blob = item.getAsFile();
    if (!blob || imageRendererFactory.mimeTypes.indexOf(blob.type) === -1) {
      continue;
    }

    handledImage = true;
    void attachImageBlob(blob, options);
  }

  if (handledImage) {
    event.preventDefault();
    return true;
  }

  return false;
}

async function attachImageBlob(
  blob: File,
  options: IStorySegmentMarkdownPasteOptions,
): Promise<void> {
  const dataUrl = await readAsDataURL(blob);
  const { href, protocol } = URLExt.parse(dataUrl);

  if (protocol !== 'data:') {
    return;
  }

  const dataURIRegex = /([\w+/]+)?(?:;(charset=[\w-]*|base64))?,(.*)/;
  const matches = dataURIRegex.exec(href);

  if (!matches || matches.length !== 4) {
    return;
  }

  const mimeType = matches[1];
  const encodedData = matches[3];
  const bundle: nbformat.IMimeBundle = { [mimeType]: encodedData };
  const uri = generateSegmentAttachmentUri(blob.name);

  setSegmentAttachment(options.model, options.segmentId, uri, bundle);
  options.insertMarkdown(formatSegmentAttachmentMarkdown(blob.name, uri));
}

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsDataURL(blob);
  });
}
