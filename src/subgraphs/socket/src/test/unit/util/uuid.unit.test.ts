import { randomUUID } from 'node:crypto';
import { mongo } from 'mongoose';
import { uuidToString } from '../../../util';

const { UUID, Binary } = mongo.BSON;

describe('uuidToString', () => {
  const value = randomUUID();

  test('passes a canonical string through', () => {
    expect(uuidToString(value)).toBe(value);
    expect(uuidToString(value.toUpperCase())).toBe(value);
  });

  test('converts a bson UUID', () => {
    expect(uuidToString(new UUID(value))).toBe(value);
  });

  test('converts a Binary of subtype 4', () => {
    const binary = new Binary(Buffer.from(value.replace(/-/g, ''), 'hex'), Binary.SUBTYPE_UUID);
    expect(uuidToString(binary)).toBe(value);
  });

  test('returns null for other values', () => {
    expect(uuidToString(null)).toBeNull();
    expect(uuidToString(undefined)).toBeNull();
    expect(uuidToString('nope')).toBeNull();
    expect(uuidToString(42)).toBeNull();
    expect(uuidToString(new Binary(Buffer.from('abc')))).toBeNull();
  });
});
