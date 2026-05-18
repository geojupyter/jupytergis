import { JupyterGISModel } from '../model';

describe('awareness field signals', () => {
  let model: JupyterGISModel;
  const originalDocument = (globalThis as any).document;

  beforeAll(() => {
    // JupyterGISModel reads from `document` during initialization.
    // Provide a minimal DOM stub for node test environment.
    (globalThis as any).document = {
      querySelectorAll: () => [],
    };
  });

  beforeEach(() => {
    model = new JupyterGISModel({});
  });

  afterEach(() => {
    model.dispose();
  });

  afterAll(() => {
    (globalThis as any).document = originalDocument;
  });

  it('emits selectedChanged when selected changes', () => {
    const events: any[] = [];
    model.selectedChanged.connect((_, args) => {
      events.push(args);
    });

    model.syncSelected({ layerA: { type: 'layer' } }, 'test');

    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('selected');
    expect(events[0].isLocalClient).toBe(true);
    expect(events[0].currentValue?.value).toEqual({
      layerA: { type: 'layer' },
    });
  });

  it('emits pointerChanged when pointer changes', () => {
    const events: any[] = [];
    model.pointerChanged.connect((_, args) => {
      events.push(args);
    });

    model.syncPointer({ coordinates: { x: 1, y: 2 } }, 'test');

    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('pointer');
    expect(events[0].isLocalClient).toBe(true);
    expect(events[0].currentValue?.value).toEqual({
      coordinates: { x: 1, y: 2 },
    });
  });

  it('emits viewportStateChanged when viewport changes', () => {
    const events: any[] = [];
    model.viewportStateChanged.connect((_, args) => {
      events.push(args);
    });

    model.syncViewport(
      { coordinates: { x: 10, y: 20 }, zoom: 4, extent: [0, 1, 2, 3] },
      'test',
    );

    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('viewportState');
    expect(events[0].isLocalClient).toBe(true);
    expect(events[0].currentValue?.value).toEqual({
      coordinates: { x: 10, y: 20 },
      zoom: 4,
      extent: [0, 1, 2, 3],
    });
  });

  it('emits identifiedFeaturesChanged when identified features change', () => {
    const events: any[] = [];
    model.identifiedFeaturesChanged.connect((_, args) => {
      events.push(args);
    });

    model.syncIdentifiedFeatures(
      [{ feature: { name: 'Feature 1' }, floaterOpen: false }],
      'test',
    );

    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('identifiedFeatures');
    expect(events[0].isLocalClient).toBe(true);
    expect(events[0].currentValue?.value).toEqual([
      { feature: { name: 'Feature 1' }, floaterOpen: false },
    ]);
  });

  it('emits remoteUserChanged when follow target changes', () => {
    const events: any[] = [];
    model.remoteUserChanged.connect((_, args) => {
      events.push(args);
    });

    model.setUserToFollow(42);

    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('remoteUser');
    expect(events[0].isLocalClient).toBe(true);
    expect(events[0].currentValue).toBe(42);
  });

  it('emits temporalControllerActiveChanged when toggled', () => {
    const events: any[] = [];
    model.temporalControllerActiveChanged.connect((_, args) => {
      events.push(args);
    });

    model.toggleTemporalController();

    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('isTemporalControllerActive');
    expect(events[0].isLocalClient).toBe(true);
    expect(events[0].currentValue).toBe(true);
  });
});
