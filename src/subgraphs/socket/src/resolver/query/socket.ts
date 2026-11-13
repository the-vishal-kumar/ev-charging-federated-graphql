import { GraphQLError } from 'graphql';
import { Types } from 'mongoose';
import { Socket } from '../../model';
import { ISocketLean, ISocketNode } from '../../type';
import { toSocketNode } from '../mapper';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export const findSocketByIdentifier = async (identifier: string): Promise<ISocketNode | null> => {
  if (!OBJECT_ID.test(identifier)) return null;
  const doc = await Socket.findById(new Types.ObjectId(identifier)).lean<ISocketLean>();
  return doc ? toSocketNode(doc) : null;
};

const socket = async (_parent: unknown, { identifier }: { identifier: string }): Promise<ISocketNode> => {
  const node = await findSocketByIdentifier(identifier);
  if (!node) throw new GraphQLError('Socket not found', { extensions: { code: 'NOT_FOUND' } });
  return node;
};

export default socket;
