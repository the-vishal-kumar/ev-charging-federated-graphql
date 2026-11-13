import { randomUUID } from 'node:crypto';
import { Kind } from 'graphql';
import { mongo, Types } from 'mongoose';
import { DateScalar, resolvers } from '../../../resolver';
import { toSocketNode } from '../../../resolver/mapper';
import { ISocketLean } from '../../../type';

const { UUID } = mongo.BSON;

describe('Date scalar', () => {
  test('serialises Date objects and strings to ISO-8601', () => {
    expect(DateScalar.serialize(new Date('2024-05-06T07:08:09Z'))).toBe('2024-05-06T07:08:09.000Z');
    expect(DateScalar.serialize('2024-05-06T07:08:09Z')).toBe('2024-05-06T07:08:09.000Z');
  });

  test('rejects invalid dates', () => {
    expect(() => DateScalar.serialize('nope')).toThrow();
  });

  test('parses literals', () => {
    expect(DateScalar.parseLiteral({ kind: Kind.STRING, value: '2024-05-06T07:08:09Z' }, {})).toEqual(
      new Date('2024-05-06T07:08:09Z'),
    );
  });
});

describe('socket mapping', () => {
  const doc = {
    _id: new Types.ObjectId(),
    serial: 7,
    uuid: new UUID(randomUUID()),
    statusType: { isOperational: true, isUserSelectable: true, id: 50, title: 'Not Operational' },
    dataProvider: {
      id: 1,
      title: 'Bundesnetzagentur.de',
      dataProviderStatusType: { id: 1, title: 'Automated Import' },
    },
    connections: [
      {
        id: 1,
        connectionType: { formalName: 'IEC 62196-2 Type 2' },
        currentType: { description: 'Direct Current', title: 'DC' },
        level: { comments: '40KW and Higher', title: 'Level 3:  High (Over 40kW)' },
      },
    ],
    dateLastStatusUpdate: new Date('2024-05-06T07:08:09Z'),
  } as unknown as ISocketLean;

  test('maps a lean doc with a bson UUID to string ids', () => {
    const node = toSocketNode(doc);
    expect(node.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(node.identifier).toMatch(/^[0-9a-f]{24}$/);
    expect(node.identifier).toBe(doc._id.toHexString());
    expect(typeof node.uuid).toBe('string');
  });

  test('maps stored titles to GraphQL enum keys', () => {
    const node = toSocketNode(doc);
    expect(resolvers.Socket.statusType(node)?.title).toBe('NotOperational');
    expect(resolvers.Socket.dataProvider(node)).toMatchObject({
      title: 'BundesnetzagenturDe',
      dataProviderStatusType: { title: 'AutomatedImport' },
    });
    expect(resolvers.Socket.connections(node)[0]).toMatchObject({
      connectionType: { formalName: 'IEC621962Type2' },
      currentType: { description: 'DirectCurrent', title: 'Dc' },
      level: { comments: 'The40KWAndHigher', title: 'Level3HighOver40KW' },
    });
  });

  test('resolves a malformed reference to null without a database', async () => {
    await expect(resolvers.Socket.__resolveReference({ identifier: 'not-an-id' })).resolves.toBeNull();
  });
});
