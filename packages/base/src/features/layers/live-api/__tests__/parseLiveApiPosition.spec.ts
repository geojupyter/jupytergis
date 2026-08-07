import { parseLiveApiPosition } from '../liveApiTypes';

describe('parseLiveApiPosition', () => {
  it('reads root latitude/longitude and scalar properties', () => {
    const position = parseLiveApiPosition({
      name: 'iss',
      latitude: 10.5,
      longitude: -20.25,
      altitude: 400,
      nested: { skip: true },
    });

    expect(position).toEqual({
      latitude: 10.5,
      longitude: -20.25,
      properties: {
        name: 'iss',
        altitude: 400,
      },
    });
  });

  it('throws when lat/lon are missing', () => {
    expect(() => parseLiveApiPosition({ latitude: 1 })).toThrow(
      /latitude and longitude/,
    );
  });
});
