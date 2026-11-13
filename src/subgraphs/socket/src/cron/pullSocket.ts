import { randomUUID } from 'node:crypto';

import { Socket, toSocketFields, decideWrite, IOcmPoi } from '../model';
import { IISOCode } from '../type';
import { generateSubBoundingBoxesOfCountry, Logger, parseCountries, readInputFileAndReturnContent } from '../util';

export interface SyncOptions {
  apiKey?: string;
  baseUrl?: string;
  countries?: IISOCode[];
  signal?: AbortSignal;
}

export interface SyncSummary {
  requests: number;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  failedRequests: number;
}

const DEFAULT_BASE_URL = 'https://api.openchargemap.io/v3';
const USER_AGENT = 'ev-charging-federated-graphql';

const emptySummary = (): SyncSummary => ({
  requests: 0,
  fetched: 0,
  inserted: 0,
  updated: 0,
  unchanged: 0,
  failedRequests: 0,
});

const buildUrl = (baseUrl: string, countryIsoCode: string, subBoundingBox: [number, number][]): string => {
  const [topLeftLongitude, topLeftLatitude] = subBoundingBox[0];
  const [bottomRightLongitude, bottomRightLatitude] = subBoundingBox[1];
  const query =
    `camelcase=true&distanceunit=km&maxresults=1000&countrycode=${countryIsoCode}` +
    `&boundingbox=(${topLeftLatitude},${topLeftLongitude}),(${bottomRightLatitude},${bottomRightLongitude})`;
  return `${baseUrl.replace(/\/+$/, '')}/poi?${query}`;
};

const fetchPois = async (url: string, apiKey: string, signal?: AbortSignal): Promise<IOcmPoi[]> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
    signal,
  });
  if (!response.ok) throw new Error(`Open Charge Map responded with HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error('Open Charge Map returned an unexpected payload');
  return body as IOcmPoi[];
};

const upsertPois = async (pois: IOcmPoi[], summary: SyncSummary): Promise<void> => {
  const bySerial = new Map<number, IOcmPoi>();
  for (const poi of pois) {
    const serial = Number(poi?.id);
    if (Number.isFinite(serial)) bySerial.set(serial, poi);
  }
  summary.fetched += bySerial.size;
  if (bySerial.size === 0) return;

  const existing = await Socket.find({ serial: { $in: [...bySerial.keys()] } }, { serial: 1, dateLastStatusUpdate: 1 })
    .lean<{ serial: number; dateLastStatusUpdate?: Date }[]>()
    .exec();
  const stored = new Map(existing.map(doc => [doc.serial, doc]));

  const operations = [...bySerial.entries()]
    .filter(([serial, poi]) => decideWrite(stored.get(serial), poi.dateLastStatusUpdate) !== 'skip')
    .map(([serial, poi]) => ({
      updateOne: {
        filter: { serial },
        update: { $set: toSocketFields(poi), $setOnInsert: { uuid: randomUUID() } },
        upsert: true,
      },
    }));

  let inserted = 0;
  let updated = 0;
  if (operations.length > 0) {
    const result = await Socket.bulkWrite(operations, { ordered: false });
    inserted = result.upsertedCount;
    updated = result.modifiedCount;
  }
  summary.inserted += inserted;
  summary.updated += updated;
  summary.unchanged += bySerial.size - inserted - updated;
};

const pullSocket = async (options: SyncOptions = {}): Promise<SyncSummary> => {
  const summary = emptySummary();
  const { apiKey, signal } = options;

  if (!apiKey) {
    Logger.warn('Unable to pull sockets: Open Charge Map API key is not set');
    return summary;
  }

  Logger.info('Socket polling initiated...');
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const countries = options.countries ?? Object.values(IISOCode);
  const countriesData = parseCountries(readInputFileAndReturnContent());

  for (const countryIsoCode of countries) {
    const country = countriesData[countryIsoCode];
    if (!country) {
      Logger.error(`No bounding box known for country ${countryIsoCode}`);
      continue;
    }
    for (const subBoundingBox of generateSubBoundingBoxesOfCountry(country.topLeft, country.bottomRight)) {
      if (signal?.aborted) {
        Logger.info('Socket polling aborted');
        return summary;
      }
      summary.requests++;
      try {
        const pois = await fetchPois(buildUrl(baseUrl, countryIsoCode, subBoundingBox), apiKey, signal);
        await upsertPois(pois, summary);
      } catch (err) {
        if (signal?.aborted) {
          Logger.info('Socket polling aborted');
          return summary;
        }
        summary.failedRequests++;
        Logger.error(
          `Request ${summary.requests} failed (${countryIsoCode}):- ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  Logger.info(`Socket polling finished: ${JSON.stringify(summary)}`);
  return summary;
};

export default pullSocket;
