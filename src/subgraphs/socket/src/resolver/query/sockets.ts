import { GraphQLError } from 'graphql';
import { Types } from 'mongoose';
import { Socket } from '../../model';
import { ISocketConnection, ISocketLean } from '../../type';
import { toSocketNode } from '../mapper';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const parseCursor = (name: string, cursor: string): Types.ObjectId => {
  if (!OBJECT_ID.test(cursor)) {
    throw new GraphQLError(`Invalid "${name}" cursor`, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return new Types.ObjectId(cursor);
};

const sockets = async (
  _parent: unknown,
  {
    after,
    before,
    first,
    last,
  }: { after?: string | null; before?: string | null; first?: number | null; last?: number | null },
): Promise<ISocketConnection> => {
  const query: { _id?: { $gt: Types.ObjectId } | { $lt: Types.ObjectId } } = {};

  if (after) query._id = { $gt: parseCursor('after', after) };
  if (before) query._id = { $lt: parseCursor('before', before) };

  const totalCount = await Socket.countDocuments(query);

  let limit = first || last || 10;
  limit = Math.min(Math.max(limit, 1), 100);

  let skip = 0;
  if (last && !first) skip = Math.max(totalCount - limit, 0);

  const docs = await Socket.find(query).sort({ _id: 1 }).skip(skip).limit(limit).lean<ISocketLean[]>();

  const hasNextPage = Boolean(first) && totalCount > limit + skip;
  const hasPreviousPage = Boolean(last) && skip > 0;

  const edges = docs.map(doc => ({
    cursor: doc._id.toHexString(),
    node: toSocketNode(doc),
  }));

  return {
    totalCount,
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
    },
  };
};

export default sockets;
