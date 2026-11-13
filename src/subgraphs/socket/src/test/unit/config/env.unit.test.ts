import { loadConfig } from '../../../config';
import { IISOCode } from '../../../type';

const base = { MONGO_URI: 'mongodb://localhost:27017/test' };

describe('loadConfig', () => {
  test('applies defaults', () => {
    expect(loadConfig({ ...base })).toEqual({
      port: 4001,
      mongoUri: base.MONGO_URI,
      openChargeMapApiKey: undefined,
      openChargeMapBaseUrl: 'https://api.openchargemap.io/v3',
      syncSchedule: '1 0 * * *',
      syncOnStart: true,
      syncCountries: [IISOCode.DE, IISOCode.IN],
    });
  });

  test('treats an empty API key as unset', () => {
    expect(loadConfig({ ...base, OPEN_CHARGE_MAP_API_KEY: '' }).openChargeMapApiKey).toBeUndefined();
    expect(loadConfig({ ...base, OPEN_CHARGE_MAP_API_KEY: 'abc' }).openChargeMapApiKey).toBe('abc');
  });

  test('reads overrides', () => {
    const config = loadConfig({
      ...base,
      PORT: '5055',
      OPEN_CHARGE_MAP_BASE_URL: 'http://localhost:9/v3',
      SOCKET_SYNC_SCHEDULE: '*/5 * * * *',
      SOCKET_SYNC_ON_START: 'false',
      SOCKET_SYNC_COUNTRIES: 'de',
    });
    expect(config).toMatchObject({
      port: 5055,
      openChargeMapBaseUrl: 'http://localhost:9/v3',
      syncSchedule: '*/5 * * * *',
      syncOnStart: false,
      syncCountries: ['DE'],
    });
  });

  test('throws on an unknown country', () => {
    expect(() => loadConfig({ ...base, SOCKET_SYNC_COUNTRIES: 'DE,XX' })).toThrow('XX');
  });

  test('throws on an invalid cron expression', () => {
    expect(() => loadConfig({ ...base, SOCKET_SYNC_SCHEDULE: 'not a cron' })).toThrow('SOCKET_SYNC_SCHEDULE');
  });

  test('throws on an invalid port', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow('PORT');
  });

  test('throws when MONGO_URI is missing', () => {
    expect(() => loadConfig({})).toThrow('MONGO_URI');
  });
});
