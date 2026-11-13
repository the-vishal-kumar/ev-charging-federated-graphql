/**
 * The whole read path, in-process: seeded MongoDB -> socket subgraph -> gateway
 * (IntrospectAndCompose) -> HTTP client. Both servers listen on ephemeral ports.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApolloServer } from '@apollo/server';
import mongoose from 'mongoose';
import { createGatewayServer, startGatewayServer } from '../../src/gateway/src/app';
import {
  connectMongo,
  createSubgraphServer,
  disconnectMongo,
  startSubgraphServer,
} from '../../src/subgraphs/socket/src/app';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OBJECT_ID = /^[0-9a-f]{24}$/;
const FIRST_ID = '6491d40a66373ff02b91cb67';
const THIRD_ID = '6491d40a66373ff02b91cb6e';

const databaseUri = (): string => {
  const url = new URL(process.env.MONGO_URI as string);
  url.pathname = `${url.pathname === '/' ? '/ev_charging' : url.pathname}_supergraph`;
  return url.toString();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GraphQLResponse = { status: number; body: { data?: any; errors?: { message: string; extensions?: any }[] } };

let subgraph: ApolloServer;
let gateway: ApolloServer;
let gatewayUrl: string;
let subgraphUrl: string;

const query = async (document: string, variables: Record<string, unknown> = {}): Promise<GraphQLResponse> => {
  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: document, variables }),
  });
  return { status: response.status, body: (await response.json()) as GraphQLResponse['body'] };
};

const SOCKETS = `
  query Sockets($first: Int, $after: String, $last: Int, $before: String) {
    sockets(first: $first, after: $after, last: $last, before: $before) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      edges { cursor node { identifier serial uuid } }
    }
  }
`;

const SOCKET = `
  query Socket($identifier: String!) {
    socket(identifier: $identifier) {
      identifier
      serial
      uuid
      dateCreated
      dateLastVerified
      dateLastStatusUpdate
      statusType { isOperational isUserSelectable id title }
      operatorInfo {
        websiteURL comments phonePrimaryContact phoneSecondaryContact isPrivateIndividual
        contactEmail faultReportEmail isRestrictedEdit id title
      }
      addressInfo {
        id title addressLine1 addressLine2 town stateOrProvince postcode countryID
        country { isoCode continentCode id title }
        latitude longitude contactTelephone1 contactTelephone2 contactEmail accessComments relatedURL
      }
      dataProvider {
        websiteURL comments isRestrictedEdit isOpenDataLicensed isApprovedImport license dateLastImported id title
        dataProviderStatusType { isProviderEnabled id title }
      }
      connections {
        id connectionTypeID reference statusTypeID levelID amps voltage powerKW currentTypeID quantity comments
        connectionType { formalName isDiscontinued isObsolete id title }
        statusType { isOperational isUserSelectable id title }
        level { comments isFastChargeCapable id title }
        currentType { description id title }
      }
    }
  }
`;

beforeAll(async () => {
  await connectMongo(databaseUri());
  const docs = readFileSync(join(__dirname, '..', 'fixtures', 'sockets.jsonl'), 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => mongoose.mongo.BSON.EJSON.parse(line));
  const collection = mongoose.connection.collection('sockets');
  await collection.deleteMany({});
  await collection.insertMany(docs);

  subgraph = createSubgraphServer();
  subgraphUrl = await startSubgraphServer(subgraph, 0);
  gateway = createGatewayServer([{ name: 'socket', url: subgraphUrl }]);
  gatewayUrl = await startGatewayServer(gateway, 0);
});

afterAll(async () => {
  await gateway?.stop();
  await subgraph?.stop();
  await mongoose.connection.dropDatabase();
  await disconnectMongo();
});

describe('Query.sockets through the gateway', () => {
  it('returns the default page of 10 when no pagination arguments are given', async () => {
    const { status, body } = await query(SOCKETS);
    expect(status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data.sockets.totalCount).toBe(11);
    expect(body.data.sockets.edges).toHaveLength(10);
    expect(body.data.sockets.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: false });
  });

  it('serialises identifiers, cursors and UUIDs as strings', async () => {
    const { body } = await query(SOCKETS, { first: 3 });
    for (const { cursor, node } of body.data.sockets.edges) {
      expect(cursor).toMatch(OBJECT_ID);
      expect(node.identifier).toBe(cursor);
      expect(node.uuid).toMatch(UUID_V4);
      expect(typeof node.serial).toBe('number');
    }
    expect(body.data.sockets.edges[0].cursor).toBe(FIRST_ID);
    expect(body.data.sockets.pageInfo.startCursor).toBe(FIRST_ID);
  });

  it('returns the first page', async () => {
    const { body } = await query(SOCKETS, { first: 5 });
    expect(body.data.sockets.totalCount).toBe(11);
    expect(body.data.sockets.edges).toHaveLength(5);
    expect(body.data.sockets.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
  });

  it('returns the last page', async () => {
    const { body } = await query(SOCKETS, { last: 5 });
    expect(body.data.sockets.totalCount).toBe(11);
    expect(body.data.sockets.edges).toHaveLength(5);
    expect(body.data.sockets.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: true });
  });

  it('pages forward from a cursor without overlap', async () => {
    const page1 = (await query(SOCKETS, { first: 4 })).body.data.sockets;
    const page2 = (await query(SOCKETS, { first: 4, after: page1.pageInfo.endCursor })).body.data.sockets;
    const ids1 = page1.edges.map((edge: { cursor: string }) => edge.cursor);
    const ids2 = page2.edges.map((edge: { cursor: string }) => edge.cursor);
    expect(ids2).toHaveLength(4);
    expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
    expect(ids2[0] > ids1[3]).toBe(true);
  });

  it('returns sockets after the specified cursor', async () => {
    const { body } = await query(SOCKETS, { after: FIRST_ID, first: 2 });
    expect(body.data.sockets.totalCount).toBe(10);
    expect(body.data.sockets.edges).toHaveLength(2);
    expect(body.data.sockets.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
  });

  it('returns sockets before the specified cursor', async () => {
    const { body } = await query(SOCKETS, { first: 2, before: THIRD_ID });
    expect(body.data.sockets.totalCount).toBe(2);
    expect(body.data.sockets.edges).toHaveLength(2);
    expect(body.data.sockets.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: false });
  });

  it('returns an empty connection before the first socket', async () => {
    const { body } = await query(SOCKETS, { before: FIRST_ID });
    expect(body.data.sockets.totalCount).toBe(0);
    expect(body.data.sockets.edges).toEqual([]);
    expect(body.data.sockets.pageInfo).toMatchObject({ startCursor: null, endCursor: null });
  });

  it('rejects a malformed cursor as bad user input', async () => {
    const { body } = await query(SOCKETS, { after: 'not-a-cursor' });
    expect(body.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('Query.socket through the gateway', () => {
  it('fails validation when identifier is not provided', async () => {
    const { status, body } = await query(SOCKET);
    expect(status).toBe(400);
    expect(body.errors?.[0].message).toBe('Variable "$identifier" of required type "String!" was not provided.');
  });

  it.each(['6491d40a66373ff02b91cb00', 'not-an-object-id'])('returns NOT_FOUND for identifier %s', async id => {
    const { status, body } = await query(SOCKET, { identifier: id });
    expect(status).toBe(200);
    expect(body.errors?.[0].message).toBe('Socket not found');
    expect(body.errors?.[0].extensions?.code).toBe('NOT_FOUND');
  });

  it('returns a socket with every field resolved', async () => {
    const { status, body } = await query(SOCKET, { identifier: FIRST_ID });
    expect(status).toBe(200);
    expect(body.errors).toBeUndefined();
    const { socket } = body.data;
    expect(socket.identifier).toBe(FIRST_ID);
    expect(socket.serial).toBe(266916);
    expect(socket.uuid).toMatch(UUID_V4);
    expect(new Date(socket.dateLastStatusUpdate).toISOString()).toBe(socket.dateLastStatusUpdate);
    expect(socket.addressInfo.country).toMatchObject({ isoCode: 'IN', title: 'India' });
    expect(socket.statusType.title).toBe('Operational');
    expect(socket.connections.length).toBeGreaterThan(0);
  });

  it('returns the same uuid via socket and sockets', async () => {
    const single = (await query(SOCKET, { identifier: FIRST_ID })).body.data.socket.uuid;
    const listed = (await query(SOCKETS, { first: 1 })).body.data.sockets.edges[0].node.uuid;
    expect(single).toBe(listed);
  });
});

describe('Socket entity (federation)', () => {
  it('resolves a Socket reference by identifier on the subgraph', async () => {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($r: [_Any!]!) { _entities(representations: $r) { ... on Socket { identifier uuid serial } } }',
        variables: { r: [{ __typename: 'Socket', identifier: FIRST_ID }] },
      }),
    });
    const { body } = { body: (await response.json()) as GraphQLResponse['body'] };
    expect(body.errors).toBeUndefined();
    expect(body.data._entities[0]).toMatchObject({ identifier: FIRST_ID, serial: 266916 });
    expect(body.data._entities[0].uuid).toMatch(UUID_V4);
  });
});
