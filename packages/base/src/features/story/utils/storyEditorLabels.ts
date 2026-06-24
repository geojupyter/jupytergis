export function formatStoryTypeLabel(storyType: string | undefined): string {
  if (!storyType) {
    return 'No story type';
  }

  return storyType.charAt(0).toUpperCase() + storyType.slice(1);
}

export function formatGradientLabel(showGradient: boolean | undefined): string {
  return showGradient !== false ? 'Gradient on' : 'Solid background';
}
