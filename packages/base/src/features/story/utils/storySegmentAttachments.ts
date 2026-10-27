import type { IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import type * as nbformat from '@jupyterlab/nbformat';
import { UUID } from '@lumino/coreutils';

import { updateSegmentContent } from './storySegmentContent';

type SegmentAttachments = NonNullable<
  NonNullable<IStorySegmentLayer['content']>['attachments']
>;

export function getSegmentAttachments(
  model: IJupyterGISModel,
  segmentId: string,
): SegmentAttachments {
  const layer = model.getLayer(segmentId);

  if (!layer || layer.type !== 'StorySegmentLayer') {
    return {};
  }

  const parameters = layer.parameters as IStorySegmentLayer;
  return parameters.content?.attachments ?? {};
}

export function setSegmentAttachment(
  model: IJupyterGISModel,
  segmentId: string,
  key: string,
  attachment: nbformat.IMimeBundle,
): void {
  const attachments: SegmentAttachments = {
    ...getSegmentAttachments(model, segmentId),
    [key]: attachment as SegmentAttachments[string],
  };

  updateSegmentContent(model, segmentId, { attachments });
}

export function generateSegmentAttachmentUri(name = ''): string {
  const lastIndex = name.lastIndexOf('.');

  return lastIndex !== -1
    ? UUID.uuid4().concat(name.substring(lastIndex))
    : UUID.uuid4();
}

export function formatSegmentAttachmentMarkdown(
  label: string,
  uri: string,
): string {
  return `![${label}](attachment:${uri})`;
}
