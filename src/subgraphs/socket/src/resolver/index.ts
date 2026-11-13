import { GraphQLScalarType } from 'graphql';
import * as Query from './query';
import { getEnumKey } from '../util';
import {
  ISocketNode,
  IDataProvider,
  IDataProviderStatusTypeTitle,
  IDataProviderTitle,
  IConnection,
  IFormalName,
  IDescription,
  ICurrentTypeTitle,
  IComments,
  ILevelTitle,
  IStatusType,
  IStatusTypeTitle,
} from '../type';

export const serializeDate = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.valueOf())) throw new TypeError('Date cannot represent an invalid date value');
  return date.toISOString();
};

export const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO-8601 date-time string',
  serialize: serializeDate,
  parseValue: (value: unknown): Date => new Date(value as string),
  parseLiteral: (ast): Date => new Date('value' in ast ? String(ast.value) : NaN),
});

const mapStatusType = (statusType: IStatusType | null | undefined): IStatusType | null | undefined =>
  statusType
    ? { ...statusType, title: getEnumKey(IStatusTypeTitle, statusType.title) as IStatusTypeTitle }
    : statusType;

export const resolvers = {
  Date: DateScalar,
  Query: {
    socket: Query.socket,
    sockets: Query.sockets,
  },
  Socket: {
    __resolveReference: async ({ identifier }: { identifier: string }): Promise<ISocketNode | null> =>
      Query.findSocketByIdentifier(String(identifier)),
    statusType: ({ statusType }: ISocketNode): IStatusType | null | undefined => mapStatusType(statusType),
    dataProvider: ({ dataProvider }: ISocketNode): IDataProvider | null | undefined =>
      dataProvider && {
        ...dataProvider,
        dataProviderStatusType: dataProvider.dataProviderStatusType && {
          ...dataProvider.dataProviderStatusType,
          title: getEnumKey(
            IDataProviderStatusTypeTitle,
            dataProvider.dataProviderStatusType.title,
          ) as IDataProviderStatusTypeTitle,
        },
        title: getEnumKey(IDataProviderTitle, dataProvider.title) as IDataProviderTitle,
      },
    connections: ({ connections }: ISocketNode): IConnection[] =>
      (connections ?? []).map(connection => {
        const plain = JSON.parse(JSON.stringify(connection)) as IConnection;
        return {
          ...plain,
          connectionType: {
            ...plain.connectionType,
            formalName: getEnumKey(IFormalName, plain.connectionType?.formalName) as IFormalName,
          },
          statusType: mapStatusType(plain.statusType) as IStatusType | null,
          currentType: {
            ...plain.currentType,
            description: getEnumKey(IDescription, plain.currentType?.description),
            title: getEnumKey(ICurrentTypeTitle, plain.currentType?.title),
          } as IConnection['currentType'],
          level: {
            ...plain.level,
            comments: getEnumKey(IComments, plain.level?.comments),
            title: getEnumKey(ILevelTitle, plain.level?.title),
          } as IConnection['level'],
        };
      }),
  },
};
