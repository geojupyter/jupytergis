import {
  applyDrawDefaultAttributesToFeature,
  isReservedDrawAttributeKey,
  validateDrawAttributeKey,
} from '../drawDefaultAttributes';

describe('drawDefaultAttributes', () => {
  describe('isReservedDrawAttributeKey', () => {
    it.each([
      '_id',
      '_createdAt',
      '_creatorClientId',
      '_fromDrawTool',
      'geometry',
      '_geometry',
    ])('reserves %s', key => {
      expect(isReservedDrawAttributeKey(key)).toBe(true);
    });

    it('allows user-defined keys', () => {
      expect(isReservedDrawAttributeKey('Label')).toBe(false);
      expect(isReservedDrawAttributeKey('species')).toBe(false);
    });
  });

  describe('validateDrawAttributeKey', () => {
    it('rejects empty keys', () => {
      expect(validateDrawAttributeKey('   ')).toEqual({
        valid: false,
        error: 'Key is required.',
      });
    });

    it('rejects reserved keys', () => {
      expect(validateDrawAttributeKey('_id')).toEqual({
        valid: false,
        error: '"_id" is a reserved property name.',
      });
    });

    it('rejects duplicate keys', () => {
      expect(validateDrawAttributeKey('Label', ['Label'])).toEqual({
        valid: false,
        error: 'Property "Label" already exists.',
      });
    });

    it('accepts valid keys', () => {
      expect(validateDrawAttributeKey('species', ['Label'])).toEqual({
        valid: true,
      });
    });
  });

  describe('applyDrawDefaultAttributesToFeature', () => {
    it('applies fallback when no defaults are configured', () => {
      const properties: Record<string, unknown> = {};
      const feature = {
        set: (key: string, value: unknown) => {
          properties[key] = value;
        },
      };

      applyDrawDefaultAttributesToFeature(feature, []);

      expect(properties).toEqual({ Label: 'New Label' });
    });

    it('applies configured defaults to the feature', () => {
      const properties: Record<string, unknown> = {};
      const feature = {
        set: (key: string, value: unknown) => {
          properties[key] = value;
        },
      };

      applyDrawDefaultAttributesToFeature(feature, [
        { key: 'species', value: 'oak' },
        { key: 'status', value: 'draft' },
      ]);

      expect(properties).toEqual({
        species: 'oak',
        status: 'draft',
      });
    });
  });
});
