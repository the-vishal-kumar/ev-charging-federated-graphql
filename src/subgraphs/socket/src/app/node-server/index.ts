import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema, type GraphQLResolverMap } from '@apollo/subgraph';
import type { GraphQLFormattedError } from 'graphql';
import { gql } from 'graphql-tag';
import { Logger } from '../../util';
import { resolvers } from '../../resolver';

const schemaPath = join(__dirname, 'schema.graphql');

export const createSubgraphServer = (): ApolloServer => {
  const typeDefs = gql(readFileSync(schemaPath, { encoding: 'utf-8' }));
  const schema = buildSubgraphSchema([
    {
      typeDefs,
      resolvers: resolvers as unknown as GraphQLResolverMap<unknown>,
    },
  ]);

  return new ApolloServer({
    schema,
    introspection: process.env.NODE_ENV !== 'production',
    stopOnTerminationSignals: false,
    formatError: (formattedError, error): GraphQLFormattedError => {
      Logger.error(`[Socket Subgraph Error]: ${String(error)}`);
      return formattedError;
    },
  });
};

export const startSubgraphServer = async (server: ApolloServer, port: number): Promise<string> => {
  const { url } = await startStandaloneServer(server, { listen: { port } });
  Logger.info(`Socket Subgraph running ${url}`);
  return url;
};
