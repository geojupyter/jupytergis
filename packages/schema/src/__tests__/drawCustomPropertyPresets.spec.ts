import { IDrawCustomPropertyPresets } from '../interfaces';
import { JupyterGISModel } from '../model';

describe('draw custom property presets on model', () => {
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
    model.setDrawCustomPropertyPreset('Trees', [
      { key: 'species', value: 'oak' },
    ]);

    expect(model.getDrawCustomPropertyPresets()).toEqual({
      Trees: [{ key: 'species', value: 'oak' }],
    });
    expect(model.sharedModel.getPreset('Trees')).toEqual([
      { key: 'species', value: 'oak' },
    ]);
    expect(model.sharedModel.getPresets()).toEqual({
      Trees: [{ key: 'species', value: 'oak' }],
    } satisfies IDrawCustomPropertyPresets);
  });

  it('overwrites an existing preset with the same name', () => {
    model.setDrawCustomPropertyPreset('Trees', [
      { key: 'species', value: 'oak' },
    ]);
    model.setDrawCustomPropertyPreset('Trees', [
      { key: 'species', value: 'pine' },
    ]);

    expect(model.getDrawCustomPropertyPresets()).toEqual({
      Trees: [{ key: 'species', value: 'pine' }],
    });
  });
});
