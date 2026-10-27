import {
  applyDrawCustomAttributesToFeature,
  isReservedDrawCustomAttributeKey,
  validateDrawCustomAttributeKey,
} from '../drawCustomAttributes';

describe('drawCustomAttributes', () => {
  describe('isReservedDrawCustomAttributeKey', () => {
    it.each([
      '_id',
      '_createdAt',
      '_creatorClientId',
      '_fromDrawTool',
      'geometry',
      '_geometry',
    ])('reserves %s', key => {
      expect(isReservedDrawCustomAttributeKey(key)).toBe(true);
    });

    it('allows user-defined keys', () => {
      expect(isReservedDrawCustomAttributeKey('Label')).toBe(false);
      expect(isReservedDrawCustomAttributeKey('species')).toBe(false);
    });
  });

  describe('validateDrawCustomAttributeKey', () => {
    it('rejects empty keys', () => {
      expect(validateDrawCustomAttributeKey('   ')).toEqual({
        valid: false,
        error: 'Key is required.',
      });
    });

    it('rejects reserved keys', () => {
      expect(validateDrawCustomAttributeKey('_id')).toEqual({
        valid: false,
        error: '"_id" is a reserved attribute name.',
      });
    });

    it('rejects duplicate keys', () => {
      expect(validateDrawCustomAttributeKey('Label', ['Label'])).toEqual({
        valid: false,
        error: 'Attribute "Label" already exists.',
      });
    });

    it('accepts valid keys', () => {
      expect(validateDrawCustomAttributeKey('species', ['Label'])).toEqual({
        valid: true,
      });
    });
  });

  describe('applyDrawCustomAttributesToFeature', () => {
    it('does nothing when no custom attributes are configured', () => {
      const featureProperties: Record<string, unknown> = {};
      const feature = {
        set: (key: string, value: unknown) => {
          featureProperties[key] = value;
        },
      };

      applyDrawCustomAttributesToFeature(feature, []);

      expect(featureProperties).toEqual({});
    });

    it('applies configured custom attributes to the feature', () => {
      const featureProperties: Record<string, unknown> = {};
      const feature = {
        set: (key: string, value: unknown) => {
          featureProperties[key] = value;
        },
      };

      applyDrawCustomAttributesToFeature(feature, [
        { key: 'species', value: 'oak' },
        { key: 'status', value: 'draft' },
      ]);

      expect(featureProperties).toEqual({
        species: 'oak',
        status: 'draft',
      });
    });
  });
});
