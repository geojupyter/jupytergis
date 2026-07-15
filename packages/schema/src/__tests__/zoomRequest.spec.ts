import { JupyterGISModel } from '../model';

describe('zoom request signal', () => {
  let model: JupyterGISModel;
  const originalDocument = (globalThis as any).document;

  beforeAll(() => {
    // JupyterGISModel reads from `document` during initialization.
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

  it('requestZoomToLayer drives centerOnPosition via zoomToPositionSignal', () => {
    const zoomed: string[] = [];
    model.zoomToPositionSignal.connect((_, id) => zoomed.push(id));

    model.sharedModel.requestZoomToLayer('layer-42');

    expect(zoomed).toEqual(['layer-42']);
  });

  it('re-fires for repeated requests to the same layer', () => {
    const zoomed: string[] = [];
    model.zoomToPositionSignal.connect((_, id) => zoomed.push(id));

    model.sharedModel.requestZoomToLayer('layer-1');
    model.sharedModel.requestZoomToLayer('layer-1');

    expect(zoomed).toEqual(['layer-1', 'layer-1']);
  });

  it('does not zoom when no request is made', () => {
    const zoomed: string[] = [];
    model.zoomToPositionSignal.connect((_, id) => zoomed.push(id));

    expect(zoomed).toEqual([]);
  });

  it('does not persist the zoom request into the serialized document', () => {
    model.sharedModel.requestZoomToLayer('layer-1');

    const serialized = JSON.parse(model.sharedModel.getSource());

    expect(serialized).not.toHaveProperty('zoomRequest');
  });
});
