import { ISocketLean, ISocketNode } from '../type';
import { uuidToString } from '../util';

/** Maps a lean Mongo document explicitly onto what GraphQL resolvers expect. */
export const toSocketNode = (doc: ISocketLean): ISocketNode => ({
  identifier: doc._id.toHexString(),
  serial: doc.serial,
  uuid: uuidToString(doc.uuid) ?? '',
  operatorInfo: doc.operatorInfo,
  statusType: doc.statusType,
  addressInfo: doc.addressInfo,
  dataProvider: doc.dataProvider,
  connections: doc.connections,
  dateCreated: doc.dateCreated,
  dateLastVerified: doc.dateLastVerified,
  dateLastStatusUpdate: doc.dateLastStatusUpdate,
});
