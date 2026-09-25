jest.mock('@/src/tools', () => ({
  getCssVarValue: jest.fn(() => ''),
}));

import type { IJGISStoryMap } from '@jupytergis/schema';

import { getSpectaPresentationCssVars } from '../utils/spectaPresentation';

describe('getSpectaPresentationCssVars', () => {
  it('sets --jgis-specta-text-color the same way regardless of presentation mode', () => {
    const guided = getSpectaPresentationCssVars({
      storyType: 'guided',
      presentationTextColor: '#AEBAD3',
    } as IJGISStoryMap) as Record<string, string>;
    const verticalScroll = getSpectaPresentationCssVars({
      storyType: 'Vertical Scroll',
      presentationTextColor: '#AEBAD3',
    } as IJGISStoryMap) as Record<string, string>;

    expect(guided['--jgis-specta-text-color']).toBe('#AEBAD3');
    expect(verticalScroll['--jgis-specta-text-color']).toBe('#AEBAD3');
  });

  it('sets --jgis-specta-content-bg-color from presentationBgColor in both modes', () => {
    const guided = getSpectaPresentationCssVars({
      storyType: 'guided',
      presentationBgColor: '#171B2C',
    } as IJGISStoryMap) as Record<string, string>;
    const verticalScroll = getSpectaPresentationCssVars({
      storyType: 'Vertical Scroll',
      presentationBgColor: '#171B2C',
    } as IJGISStoryMap) as Record<string, string>;

    expect(guided['--jgis-specta-content-bg-color']).toBe('#171B2C');
    expect(verticalScroll['--jgis-specta-content-bg-color']).toBe('#171B2C');
  });

  it('sets no color custom properties when no colors are configured', () => {
    const guided = getSpectaPresentationCssVars({
      storyType: 'guided',
    } as IJGISStoryMap) as Record<string, string>;
    const verticalScroll = getSpectaPresentationCssVars({
      storyType: 'Vertical Scroll',
    } as IJGISStoryMap) as Record<string, string>;

    expect(guided['--jgis-specta-text-color']).toBeUndefined();
    expect(guided['--jgis-specta-content-bg-color']).toBeUndefined();
    expect(verticalScroll['--jgis-specta-text-color']).toBeUndefined();
    expect(verticalScroll['--jgis-specta-content-bg-color']).toBeUndefined();
  });
});
