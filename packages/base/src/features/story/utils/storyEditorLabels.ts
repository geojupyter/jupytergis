import { STORY_TYPE } from '@/src/types';

const STORY_TYPE_LABELS: Record<string, string> = {
  [STORY_TYPE.guided]: 'Guided',
  [STORY_TYPE.unguided]: 'Unguided',
  [STORY_TYPE.verticalScroll]: 'Vertical scroll',
};

export function formatStoryTypeLabel(storyType: string | undefined): string {
  if (!storyType) {
    return 'No story type';
  }

  return STORY_TYPE_LABELS[storyType] ?? storyType;
}

export function formatGradientLabel(showGradient: boolean | undefined): string {
  return showGradient !== false ? 'Gradient on' : 'Solid background';
}
