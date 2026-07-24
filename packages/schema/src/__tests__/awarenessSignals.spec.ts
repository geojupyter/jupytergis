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

  it('emits drawCustomAttributesChanged when draw custom attributes change', () => {
    const events: any[] = [];
    model.drawCustomAttributesChanged.connect((_, args) => {
      events.push(args);
    });

    model.setDrawCustomAttributesForLayer(
      'layer-a',
      [{ key: 'species', value: 'oak' }],
      'test',
    );

    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('drawCustomAttributes');
    expect(events[0].isLocalClient).toBe(true);
    expect(events[0].currentValue?.value['layer-a']).toMatchObject({
      attributes: [{ key: 'species', value: 'oak' }],
    });
    expect(events[0].currentValue?.value['layer-a'].updatedAt).toEqual(
      expect.any(Number),
    );
  });

  it('emits drawCustomAttributesChanged on subsequent updates', () => {
    let now = 1_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    const events: any[] = [];
    model.drawCustomAttributesChanged.connect((_, args) => {
      events.push(args);
    });

    model.setDrawCustomAttributesForLayer(
      'layer-a',
      [{ key: 'species', value: 'oak' }],
      'test',
    );
    now = 2_000;
    model.setDrawCustomAttributesForLayer(
      'layer-a',
      [
        { key: 'species', value: 'oak' },
        { key: 'status', value: 'draft' },
      ],
      'test',
    );

    expect(events).toHaveLength(2);
    expect(events[1].currentValue?.value['layer-a']).toEqual({
      updatedAt: 2_000,
      attributes: [
        { key: 'species', value: 'oak' },
        { key: 'status', value: 'draft' },
      ],
    });

    dateNowSpy.mockRestore();
  });

  it('clears draw custom attributes for a removed layer', () => {
    model.setDrawCustomAttributesForLayer(
      'layer-a',
      [{ key: 'species', value: 'oak' }],
      'test',
    );
    model.setDrawCustomAttributesForLayer(
      'layer-b',
      [{ key: 'status', value: 'draft' }],
      'test',
    );

    model.clearDrawCustomAttributesForLayer('layer-a', 'test');

    expect(model.getDrawCustomAttributes('layer-a')).toEqual([]);
    expect(model.getDrawCustomAttributes('layer-b')).toEqual([
      { key: 'status', value: 'draft' },
    ]);
  });

  it('uses the most recently updated draw custom attributes across awareness clients', () => {
    model.syncDrawCustomAttributes({
      'layer-a': {
        updatedAt: 100,
        attributes: [{ key: 'species', value: 'oak' }],
      },
    });

    const remoteClientId = 4242;
    const clients = model.sharedModel.awareness.getStates();
    clients.set(remoteClientId, {
      ...(clients.get(model.getClientId()) as object),
      drawCustomAttributes: {
        value: {
          'layer-a': {
            updatedAt: 200,
            attributes: [{ key: 'status', value: 'draft' }],
          },
        },
      },
    } as any);

    expect(model.getDrawCustomAttributes('layer-a')).toEqual([
      { key: 'status', value: 'draft' },
    ]);
  });

  it('prefers the higher client id when draw custom attributes share the same updatedAt', () => {
    model.syncDrawCustomAttributes({
      'layer-a': {
        updatedAt: 100,
        attributes: [{ key: 'species', value: 'oak' }],
      },
    });

    const localClientId = model.getClientId();
    const remoteClientId = localClientId + 1;
    const clients = model.sharedModel.awareness.getStates();
    clients.set(remoteClientId, {
      ...(clients.get(localClientId) as object),
      drawCustomAttributes: {
        value: {
          'layer-a': {
            updatedAt: 100,
            attributes: [{ key: 'status', value: 'draft' }],
          },
        },
      },
    } as any);

    expect(model.getDrawCustomAttributes('layer-a')).toEqual([
      { key: 'status', value: 'draft' },
    ]);
  });

  it('applies removals from the latest update', () => {
    model.syncDrawCustomAttributes({
      'layer-a': {
        updatedAt: 100,
        attributes: [
          { key: 'species', value: 'oak' },
          { key: 'status', value: 'draft' },
        ],
      },
    });

    const remoteClientId = 4242;
    const clients = model.sharedModel.awareness.getStates();
    clients.set(remoteClientId, {
      ...(clients.get(model.getClientId()) as object),
      drawCustomAttributes: {
        value: {
          'layer-a': {
            updatedAt: 100,
            attributes: [
              { key: 'species', value: 'oak' },
              { key: 'status', value: 'draft' },
            ],
          },
        },
      },
    } as any);

    model.syncDrawCustomAttributes({
      'layer-a': {
        updatedAt: 200,
        attributes: [{ key: 'species', value: 'oak' }],
      },
    });

    expect(model.getDrawCustomAttributes('layer-a')).toEqual([
      { key: 'species', value: 'oak' },
    ]);
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

  it('does not emit unrelated awareness field signals on updates', () => {
    model.syncIdentifiedFeatures(
      [{ feature: { name: 'Feature 1' }, floaterOpen: false }],
      'test',
    );

    const identifiedEvents: any[] = [];
    const drawCustomEvents: any[] = [];
    model.identifiedFeaturesChanged.connect((_, args) => {
      identifiedEvents.push(args);
    });
    model.drawCustomAttributesChanged.connect((_, args) => {
      drawCustomEvents.push(args);
    });

    model.syncPointer({ coordinates: { x: 1, y: 2 } }, 'test');
    model.syncPointer({ coordinates: { x: 3, y: 4 } }, 'test');

    expect(identifiedEvents).toHaveLength(0);
    expect(drawCustomEvents).toHaveLength(0);
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
