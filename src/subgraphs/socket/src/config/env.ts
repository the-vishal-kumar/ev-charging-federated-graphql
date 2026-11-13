import { validate } from 'node-cron';
import { IISOCode } from '../type';

export interface SocketConfig {
  port: number;
  mongoUri: string;
  openChargeMapApiKey?: string;
  openChargeMapBaseUrl: string;
  syncSchedule: string;
  syncOnStart: boolean;
  syncCountries: IISOCode[];
}

const DEFAULT_PORT = 4001;
const DEFAULT_BASE_URL = 'https://api.openchargemap.io/v3';
const DEFAULT_SCHEDULE = '1 0 * * *';
const DEFAULT_COUNTRIES = 'DE,IN';

const parsePort = (value: string | undefined): number => {
  if (value === undefined || value.trim() === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`PORT is invalid: ${value}`);
  return port;
};

const parseCountries = (value: string): IISOCode[] => {
  const known = Object.values(IISOCode) as string[];
  const codes = value
    .split(',')
    .map(code => code.trim().toUpperCase())
    .filter(code => code !== '');
  if (codes.length === 0) throw new Error('SOCKET_SYNC_COUNTRIES must list at least one country');
  const unknown = codes.filter(code => !known.includes(code));
  if (unknown.length > 0) {
    throw new Error(`SOCKET_SYNC_COUNTRIES has unknown country code(s): ${unknown.join(', ')}`);
  }
  return [...new Set(codes)] as IISOCode[];
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): SocketConfig => {
  const mongoUri = env.MONGO_URI?.trim();
  if (!mongoUri) throw new Error('MONGO_URI is required');

  const syncSchedule = env.SOCKET_SYNC_SCHEDULE?.trim() || DEFAULT_SCHEDULE;
  if (!validate(syncSchedule)) throw new Error(`SOCKET_SYNC_SCHEDULE is not a valid cron expression: ${syncSchedule}`);

  return {
    port: parsePort(env.PORT),
    mongoUri,
    openChargeMapApiKey: env.OPEN_CHARGE_MAP_API_KEY?.trim() || undefined,
    openChargeMapBaseUrl: env.OPEN_CHARGE_MAP_BASE_URL?.trim() || DEFAULT_BASE_URL,
    syncSchedule,
    syncOnStart: env.SOCKET_SYNC_ON_START?.trim().toLowerCase() !== 'false',
    syncCountries: parseCountries(env.SOCKET_SYNC_COUNTRIES?.trim() || DEFAULT_COUNTRIES),
  };
};
