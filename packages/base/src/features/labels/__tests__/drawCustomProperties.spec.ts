import {
  applyDrawCustomPropertiesToFeature,
  isReservedDrawCustomPropertyKey,
  validateDrawCustomPropertyKey,
} from '../drawCustomProperties';

describe('drawCustomProperties', () => {
  describe('isReservedDrawCustomPropertyKey', () => {
    it.each([
      '_id',
      '_createdAt',
      '_creatorClientId',
      '_fromDrawTool',
      'geometry',
      '_geometry',
    ])('reserves %s', key => {
      expect(isReservedDrawCustomPropertyKey(key)).toBe(true);
    });

    it('allows user-defined keys', () => {
      expect(isReservedDrawCustomPropertyKey('Label')).toBe(false);
      expect(isReservedDrawCustomPropertyKey('species')).toBe(false);
    });
  });

  describe('validateDrawCustomPropertyKey', () => {
    it('rejects empty keys', () => {
      expect(validateDrawCustomPropertyKey('   ')).toEqual({
        valid: false,
        error: 'Key is required.',
      });
    });

    it('rejects reserved keys', () => {
      expect(validateDrawCustomPropertyKey('_id')).toEqual({
        valid: false,
        error: '"_id" is a reserved property name.',
      });
    });

    it('rejects duplicate keys', () => {
      expect(validateDrawCustomPropertyKey('Label', ['Label'])).toEqual({
        valid: false,
        error: 'Property "Label" already exists.',
      });
    });

    it('accepts valid keys', () => {
      expect(validateDrawCustomPropertyKey('species', ['Label'])).toEqual({
        valid: true,
      });
    });
  });

  describe('applyDrawCustomPropertiesToFeature', () => {
    it('does nothing when no custom properties are configured', () => {
      const properties: Record<string, unknown> = {};
      const feature = {
        set: (key: string, value: unknown) => {
          properties[key] = value;
        },
      };

      applyDrawCustomPropertiesToFeature(feature, []);

      expect(properties).toEqual({});
    });

    it('applies configured custom properties to the feature', () => {
      const properties: Record<string, unknown> = {};
      const feature = {
        set: (key: string, value: unknown) => {
          properties[key] = value;
        },
      };

      applyDrawCustomPropertiesToFeature(feature, [
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
