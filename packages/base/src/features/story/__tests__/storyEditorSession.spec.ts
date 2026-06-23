/**
 * @jest-environment jsdom
 */

jest.mock('../utils/storySegmentMapView', () => ({
  updateSegmentMapView: jest.fn(),
}));

jest.mock('../utils/storySegmentOverrides', () => ({
  applySegmentLayerOverrides: jest.fn(),
  clearSegmentLayerOverrideEntries: jest.fn(),
}));

jest.mock('../components/StoryMapInteractionBarWidget', () => ({
  StoryMapInteractionBarWidget: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
}));

jest.mock('@lumino/widgets', () => ({
  Widget: {
    attach: jest.fn(),
  },
}));

jest.mock('@/src/constants', () => ({
  CommandIDs: {
    togglePanel: 'jupytergis:togglePanel',
  },
}));

import { CommandIDs } from '@/src/constants';
import { StoryEditorSession } from '../storyEditorSession';
import { updateSegmentMapView } from '../utils/storySegmentMapView';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from '../utils/storySegmentOverrides';

function createDialog() {
  return {
    minimize: jest.fn(),
    restore: jest.fn(),
    activate: jest.fn(),
  };
}

function createModel() {
  return {
    centerOnPosition: jest.fn(),
  };
}

function createCommands() {
  return {
    execute: jest.fn(),
    isToggled: jest.fn(() => false),
  } as unknown as import('@lumino/commands').CommandRegistry;
}

describe('StoryEditorSession', () => {
  let session: StoryEditorSession;

  beforeEach(() => {
    session = StoryEditorSession.getInstance();
    session.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    session.clear();
  });

  it('reports inactive until a dialog is attached', () => {
    const model = createModel();

    expect(session.isActiveFor(model as never)).toBe(false);
    expect(session.isMapInteractionMode()).toBe(false);
  });

  it('enters map view mode and applies the segment view', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    session.attachDialog(dialog as never, model as never, commands);
    session.enterMapViewMode('segment-1');

    expect(session.isMapViewMode()).toBe(true);
    expect(model.centerOnPosition).toHaveBeenCalledWith('segment-1');
    expect(dialog.minimize).toHaveBeenCalled();
    expect(commands.execute).toHaveBeenCalledWith(CommandIDs.togglePanel);

    session.applyMapView();

    expect(updateSegmentMapView).toHaveBeenCalledWith(model, 'segment-1');
    expect(dialog.restore).toHaveBeenCalled();
    expect(session.isMapInteractionMode()).toBe(false);
  });

  it('previews a segment and clears overrides when restored', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    session.attachDialog(dialog as never, model as never, commands);
    session.enterPreviewMode('segment-2');

    expect(session.isPreviewingSegment()).toBe(true);
    expect(applySegmentLayerOverrides).toHaveBeenCalledWith(
      model,
      'segment-2',
      [],
    );
    expect(dialog.minimize).toHaveBeenCalled();
    expect(commands.execute).toHaveBeenCalledWith(CommandIDs.togglePanel);

    session.restoreEditor();

    expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
    expect(dialog.restore).toHaveBeenCalled();
    expect(session.isMapInteractionMode()).toBe(false);
  });

  it('clears preview overrides when the dialog is dismissed', () => {
    const dialog = createDialog();
    const model = createModel();
    const commands = createCommands();

    session.attachDialog(dialog as never, model as never, commands);
    session.enterPreviewMode('segment-3');
    session.clear();

    expect(clearSegmentLayerOverrideEntries).toHaveBeenCalledWith(model, []);
    expect(session.isActiveFor(model as never)).toBe(false);
  });
});
