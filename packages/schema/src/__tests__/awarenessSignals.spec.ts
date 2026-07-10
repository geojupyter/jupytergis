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

  it('emits drawDefaultAttributesChanged when draw defaults change', () => {
    const events: any[] = [];
    model.drawDefaultAttributesChanged.connect((_, args) => {
      events.push(args);
    });

    model.setDrawDefaultAttributesForLayer(
      'layer-a',
      [{ key: 'species', value: 'oak' }],
      'test',
    );

    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('drawDefaultAttributes');
    expect(events[0].isLocalClient).toBe(true);
    expect(events[0].currentValue?.value['layer-a']).toMatchObject({
      attributes: [{ key: 'species', value: 'oak' }],
    });
    expect(events[0].currentValue?.value['layer-a'].updatedAt).toEqual(
      expect.any(Number),
    );
  });

  it('emits drawDefaultAttributesChanged on subsequent updates', () => {
    let now = 1_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    const events: any[] = [];
    model.drawDefaultAttributesChanged.connect((_, args) => {
      events.push(args);
    });

    model.setDrawDefaultAttributesForLayer(
      'layer-a',
      [{ key: 'species', value: 'oak' }],
      'test',
    );
    now = 2_000;
    model.setDrawDefaultAttributesForLayer(
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

  it('clears draw defaults for a removed layer', () => {
    model.setDrawDefaultAttributesForLayer(
      'layer-a',
      [{ key: 'species', value: 'oak' }],
      'test',
    );
    model.setDrawDefaultAttributesForLayer(
      'layer-b',
      [{ key: 'status', value: 'draft' }],
      'test',
    );

    model.clearDrawDefaultAttributesForLayer('layer-a', 'test');

    expect(model.getDrawDefaultAttributes('layer-a')).toEqual([]);
    expect(model.getDrawDefaultAttributes('layer-b')).toEqual([
      { key: 'status', value: 'draft' },
    ]);
  });

  it('uses the most recently updated draw defaults across awareness clients', () => {
    model.syncDrawDefaultAttributes({
      'layer-a': {
        updatedAt: 100,
        attributes: [{ key: 'species', value: 'oak' }],
      },
    });

    const remoteClientId = 4242;
    const clients = model.sharedModel.awareness.getStates();
    clients.set(remoteClientId, {
      ...(clients.get(model.getClientId()) as object),
      drawDefaultAttributes: {
        value: {
          'layer-a': {
            updatedAt: 200,
            attributes: [{ key: 'status', value: 'draft' }],
          },
        },
      },
    } as any);

    expect(model.getDrawDefaultAttributes('layer-a')).toEqual([
      { key: 'status', value: 'draft' },
    ]);
  });

  it('prefers the higher client id when draw defaults share the same updatedAt', () => {
    model.syncDrawDefaultAttributes({
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
      drawDefaultAttributes: {
        value: {
          'layer-a': {
            updatedAt: 100,
            attributes: [{ key: 'status', value: 'draft' }],
          },
        },
      },
    } as any);

    expect(model.getDrawDefaultAttributes('layer-a')).toEqual([
      { key: 'status', value: 'draft' },
    ]);
  });

  it('applies removals from the latest update', () => {
    model.syncDrawDefaultAttributes({
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
      drawDefaultAttributes: {
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

    model.syncDrawDefaultAttributes({
      'layer-a': {
        updatedAt: 200,
        attributes: [{ key: 'species', value: 'oak' }],
      },
    });

    expect(model.getDrawDefaultAttributes('layer-a')).toEqual([
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
    const drawDefaultEvents: any[] = [];
    model.identifiedFeaturesChanged.connect((_, args) => {
      identifiedEvents.push(args);
    });
    model.drawDefaultAttributesChanged.connect((_, args) => {
      drawDefaultEvents.push(args);
    });

    model.syncPointer({ coordinates: { x: 1, y: 2 } }, 'test');
    model.syncPointer({ coordinates: { x: 3, y: 4 } }, 'test');

    expect(identifiedEvents).toHaveLength(0);
    expect(drawDefaultEvents).toHaveLength(0);
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
