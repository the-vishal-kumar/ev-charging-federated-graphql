import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../../../app';
import { pullSocket } from '../../../cron';
import { Socket } from '../../../model';
import { IISOCode } from '../../../type';
import { uuidToString } from '../../../util';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const API_KEY = 'fake-ocm-key';
const options = { apiKey: API_KEY, baseUrl: 'http://ocm.test/v3', countries: [IISOCode.DE] };

const databaseUri = (): string => {
  const url = new URL(process.env.MONGO_URI as string);
  url.pathname = `${url.pathname === '/' ? '/ev_charging' : url.pathname}_pullsocket`;
  return url.toString();
};

const makePoi = (id: number, dateLastStatusUpdate: string, title = 'Station'): Record<string, unknown> => ({
  id,
  uuid: `ocm-${id}`,
  operatorInfo: { id: 1, title: '(Unknown Operator)' },
  statusType: { isOperational: true, isUserSelectable: true, id: 50, title: 'Operational' },
  addressInfo: {
    id: id + 1000,
    title,
    addressLine1: 'Street 1',
    town: 'Berlin',
    countryID: 1,
    country: { isoCode: 'DE', continentCode: 'EU', id: 1, title: 'Germany' },
    latitude: 52.5 + id / 1000,
    longitude: 13.4 + id / 1000,
  },
  dataProvider: {
    id: 1,
    title: 'Bundesnetzagentur.de',
    isOpenDataLicensed: true,
    dataProviderStatusType: { isProviderEnabled: true, id: 1, title: 'Automated Import' },
  },
  connections: [
    {
      id: id + 5000,
      connectionTypeID: 25,
      connectionType: { formalName: 'IEC 62196-2 Type 2', id: 25, title: 'Type 2' },
      powerKW: 22,
      quantity: 1,
    },
  ],
  dateCreated: '2023-01-01T00:00:00Z',
  dateLastStatusUpdate,
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Returns `firstBody` for the first request and an empty list for the rest. */
const stubFetch = (firstBody: unknown[]): jest.SpyInstance => {
  let call = 0;
  return jest.spyOn(global, 'fetch').mockImplementation(async () => jsonResponse(call++ === 0 ? firstBody : []));
};

describe('pullSocket (against MongoDB)', () => {
  beforeAll(async () => {
    await connectMongo(databaseUri());
    await Socket.init();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectMongo();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const rawDocs = async (): Promise<{ _id: unknown; serial: number; uuid: unknown }[]> =>
    mongoose.connection.collection('sockets').find({}).sort({ serial: 1 }).toArray() as never;

  const fixture = [
    makePoi(101, '2024-01-01T00:00:00Z'),
    makePoi(102, '2024-01-01T00:00:00Z'),
    makePoi(103, '2024-01-01T00:00:00Z'),
  ];

  test('without an API key nothing is requested', async () => {
    const fetchSpy = stubFetch(fixture);
    const summary = await pullSocket({ ...options, apiKey: undefined });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(summary).toEqual({ requests: 0, fetched: 0, inserted: 0, updated: 0, unchanged: 0, failedRequests: 0 });
    expect(await Socket.countDocuments()).toBe(0);
  });

  test('first run inserts every station with a UUID v4 and sends the key as a header', async () => {
    const fetchSpy = stubFetch(fixture);
    const summary = await pullSocket(options);

    expect(summary).toMatchObject({ fetched: 3, inserted: 3, updated: 0, unchanged: 0, failedRequests: 0 });
    expect(summary.requests).toBeGreaterThan(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).not.toContain(API_KEY);
    expect(String(url)).toContain('countrycode=DE');
    expect(init.headers).toMatchObject({ 'X-API-Key': API_KEY, 'User-Agent': 'ev-charging-federated-graphql' });

    const viaModel = await Socket.find({}).sort({ serial: 1 }).lean();
    expect(viaModel.map(doc => doc.serial)).toEqual([101, 102, 103]);
    for (const doc of viaModel) expect(uuidToString(doc.uuid)).toMatch(UUID_V4);

    const raw = await rawDocs();
    expect(raw).toHaveLength(3);
    for (const doc of raw) expect(uuidToString(doc.uuid)).toMatch(UUID_V4);
    expect(new Set(raw.map(doc => uuidToString(doc.uuid))).size).toBe(3);

    expect(viaModel[0].location).toEqual({ type: 'Point', coordinates: [13.4 + 0.101, 52.5 + 0.101] });
  });

  test('an identical second run changes nothing', async () => {
    const before = await rawDocs();
    stubFetch(fixture);
    const summary = await pullSocket(options);
    expect(summary).toMatchObject({ fetched: 3, inserted: 0, updated: 0, unchanged: 3, failedRequests: 0 });

    const after = await rawDocs();
    expect(after.map(doc => String(doc._id))).toEqual(before.map(doc => String(doc._id)));
    expect(after.map(doc => uuidToString(doc.uuid))).toEqual(before.map(doc => uuidToString(doc.uuid)));
  });

  test('a newer dateLastStatusUpdate updates exactly that station and keeps its ids', async () => {
    const before = await rawDocs();
    stubFetch([fixture[0], makePoi(102, '2024-02-01T00:00:00Z', 'Renamed'), fixture[2]]);
    const summary = await pullSocket(options);
    expect(summary).toMatchObject({ fetched: 3, inserted: 0, updated: 1, unchanged: 2, failedRequests: 0 });

    const after = await rawDocs();
    expect(after.map(doc => String(doc._id))).toEqual(before.map(doc => String(doc._id)));
    expect(after.map(doc => uuidToString(doc.uuid))).toEqual(before.map(doc => uuidToString(doc.uuid)));

    const changed = await Socket.findOne({ serial: 102 }).lean();
    expect(changed?.addressInfo.title).toBe('Renamed');
    expect(changed?.dateLastStatusUpdate).toEqual(new Date('2024-02-01T00:00:00Z'));
    expect((await Socket.findOne({ serial: 101 }).lean())?.addressInfo.title).toBe('Station');
  });

  test('a non-ok response counts as a failed request and does not throw', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async () => jsonResponse({ error: 'denied' }, 403));
    const summary = await pullSocket(options);
    expect(summary.failedRequests).toBe(summary.requests);
    expect(summary.requests).toBeGreaterThan(0);
    expect(summary).toMatchObject({ fetched: 0, inserted: 0, updated: 0 });
  });

  test('an aborted signal stops the run', async () => {
    const fetchSpy = stubFetch(fixture);
    const controller = new AbortController();
    controller.abort();
    const summary = await pullSocket({ ...options, signal: controller.signal });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(summary.requests).toBe(0);
  });
});
