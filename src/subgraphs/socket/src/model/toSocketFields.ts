import { ISocket } from '../type';

/** The subset of an Open Charge Map POI (camelCase) that is stored. */
export interface IOcmPoi {
  id: number | string;
  operatorInfo?: unknown;
  statusType?: unknown;
  addressInfo: { latitude: number; longitude: number; [key: string]: unknown };
  dataProvider?: { dateLastImported?: string | Date | null; [key: string]: unknown } | null;
  connections?: unknown[];
  dateCreated?: string | Date | null;
  dateLastVerified?: string | Date | null;
  dateLastStatusUpdate: string | Date;
  [key: string]: unknown;
}

export type SocketFields = Omit<ISocket, 'uuid' | 'dateCreated' | 'dateLastVerified' | 'dateLastStatusUpdate'> & {
  dateCreated?: Date;
  dateLastVerified?: Date;
  dateLastStatusUpdate: Date;
};

const toDate = (value: string | Date | null | undefined): Date | undefined => {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
};

const defined = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null)) as T;

/**
 * Maps an Open Charge Map POI onto the stored socket fields. Never includes
 * `_id` or `uuid`: those belong to the stored document and are never rewritten.
 */
export const toSocketFields = (poi: IOcmPoi): SocketFields => {
  const dataProvider = poi.dataProvider
    ? defined({ ...poi.dataProvider, dateLastImported: toDate(poi.dataProvider.dateLastImported) })
    : undefined;

  return defined({
    serial: Number(poi.id),
    operatorInfo: poi.operatorInfo,
    statusType: poi.statusType,
    addressInfo: poi.addressInfo,
    location: { type: 'Point', coordinates: [poi.addressInfo.longitude, poi.addressInfo.latitude] },
    dataProvider,
    connections: poi.connections ?? [],
    dateCreated: toDate(poi.dateCreated),
    dateLastVerified: toDate(poi.dateLastVerified),
    dateLastStatusUpdate: toDate(poi.dateLastStatusUpdate),
  }) as unknown as SocketFields;
};

export type WriteDecision = 'insert' | 'update' | 'skip';

/** A station is written only when new, or strictly newer than the stored one. */
export const decideWrite = (
  stored: { dateLastStatusUpdate?: Date | string | null } | undefined,
  fetchedDateLastStatusUpdate: Date | string | null | undefined,
): WriteDecision => {
  const fetched = toDate(fetchedDateLastStatusUpdate);
  if (!fetched) return 'skip';
  if (!stored) return 'insert';
  const storedDate = toDate(stored.dateLastStatusUpdate);
  if (!storedDate) return 'update';
  return fetched.valueOf() > storedDate.valueOf() ? 'update' : 'skip';
};
