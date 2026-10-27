import { IDrawCustomAttributePresets } from '../interfaces';
import { JupyterGISModel } from '../model';

describe('draw custom attribute presets on model', () => {
  let model: JupyterGISModel;
  const originalDocument = (globalThis as any).document;

  beforeAll(() => {
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

  it('stores and reads presets at the document top level', () => {
    model.setDrawCustomAttributePreset('Trees', [
      { key: 'species', value: 'oak' },
    ]);

    expect(model.getDrawCustomAttributePresets()).toEqual({
      Trees: [{ key: 'species', value: 'oak' }],
    });
    expect(model.sharedModel.getPreset('Trees')).toEqual([
      { key: 'species', value: 'oak' },
    ]);
    expect(model.sharedModel.getPresets()).toEqual({
      Trees: [{ key: 'species', value: 'oak' }],
    } satisfies IDrawCustomAttributePresets);
  });

  it('overwrites an existing preset with the same name', () => {
    model.setDrawCustomAttributePreset('Trees', [
      { key: 'species', value: 'oak' },
    ]);
    model.setDrawCustomAttributePreset('Trees', [
      { key: 'species', value: 'pine' },
    ]);

    expect(model.getDrawCustomAttributePresets()).toEqual({
      Trees: [{ key: 'species', value: 'pine' }],
    });
  });
});
