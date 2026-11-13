import { decideWrite, IOcmPoi, toSocketFields } from '../../../model';

const poi: IOcmPoi = {
  id: 1234,
  uuid: 'ocm-uuid-that-must-not-be-stored',
  usageType: { id: 1 },
  operatorInfo: { id: 1, title: '(Unknown Operator)' },
  statusType: { id: 50, title: 'Operational' },
  addressInfo: { id: 9, title: 'Somewhere', latitude: 52.5, longitude: 13.4 },
  dataProvider: { id: 1, title: 'Bundesnetzagentur.de', dateLastImported: '2024-01-02T03:04:05Z' },
  connections: [{ id: 1 }],
  dateCreated: '2023-01-01T00:00:00Z',
  dateLastVerified: null,
  dateLastStatusUpdate: '2024-05-06T07:08:09Z',
};

describe('toSocketFields', () => {
  const fields = toSocketFields(poi);

  test('derives serial and a [lng, lat] point', () => {
    expect(fields.serial).toBe(1234);
    expect(fields.location).toEqual({ type: 'Point', coordinates: [13.4, 52.5] });
  });

  test('never carries _id, uuid, the source id or unknown fields', () => {
    expect(fields).not.toHaveProperty('_id');
    expect(fields).not.toHaveProperty('uuid');
    expect(fields).not.toHaveProperty('id');
    expect(fields).not.toHaveProperty('usageType');
  });

  test('converts dates and drops null ones', () => {
    expect(fields.dateLastStatusUpdate).toEqual(new Date('2024-05-06T07:08:09Z'));
    expect(fields.dateCreated).toEqual(new Date('2023-01-01T00:00:00Z'));
    expect(fields).not.toHaveProperty('dateLastVerified');
    expect(fields.dataProvider.dateLastImported).toEqual(new Date('2024-01-02T03:04:05Z'));
  });
});

describe('decideWrite', () => {
  const stored = { dateLastStatusUpdate: new Date('2024-05-06T07:08:09Z') };

  test('inserts a station that is not stored', () => {
    expect(decideWrite(undefined, '2024-05-06T07:08:09Z')).toBe('insert');
  });

  test('skips an identical timestamp', () => {
    expect(decideWrite(stored, '2024-05-06T07:08:09Z')).toBe('skip');
  });

  test('skips an older timestamp', () => {
    expect(decideWrite(stored, '2024-05-06T07:08:08Z')).toBe('skip');
  });

  test('updates a strictly newer timestamp', () => {
    expect(decideWrite(stored, '2024-05-06T07:08:10Z')).toBe('update');
  });

  test('skips an unparseable timestamp', () => {
    expect(decideWrite(undefined, 'garbage')).toBe('skip');
    expect(decideWrite(stored, null)).toBe('skip');
  });
});
