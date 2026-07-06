import {
  DRAW_DEFAULT_ATTRIBUTE_PRESETS_METADATA_KEY,
  IDrawDefaultAttributePresets,
} from '../interfaces';
import { JupyterGISModel } from '../model';

describe('draw default attribute presets on model', () => {
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

  it('stores and reads presets from metadata', () => {
    model.setDrawDefaultAttributePreset('Trees', [
      { key: 'species', value: 'oak' },
    ]);

    expect(model.getDrawDefaultAttributePresets()).toEqual({
      Trees: [{ key: 'species', value: 'oak' }],
    });
    expect(
      model.sharedModel.getMetadata(DRAW_DEFAULT_ATTRIBUTE_PRESETS_METADATA_KEY),
    ).toEqual({
      Trees: [{ key: 'species', value: 'oak' }],
    } satisfies IDrawDefaultAttributePresets);
  });

  it('overwrites an existing preset with the same name', () => {
    model.setDrawDefaultAttributePreset('Trees', [
      { key: 'species', value: 'oak' },
    ]);
    model.setDrawDefaultAttributePreset('Trees', [
      { key: 'species', value: 'pine' },
    ]);

    expect(model.getDrawDefaultAttributePresets()).toEqual({
      Trees: [{ key: 'species', value: 'pine' }],
    });
  });
});
