import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import type { GraphQLFormattedError } from 'graphql';
import type { GatewayConfig } from '../config';
import { Logger } from '../util';

/**
 * Composes the supergraph at start-up by introspecting each subgraph.
 * Start-up fails if a subgraph is unreachable, so the container restarts until it is up.
 */
export const createGatewayServer = (subgraphs: GatewayConfig['subgraphs']): ApolloServer => {
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({ subgraphs }),
  });

  return new ApolloServer({
    gateway,
    introspection: process.env.NODE_ENV !== 'production',
    // Shutdown is handled in src/index.ts so the process can exit 0.
    stopOnTerminationSignals: false,
    formatError: (formattedError, error): GraphQLFormattedError => {
      Logger.error(`[Gateway Error]: ${String(error)}`);
      return formattedError;
    },
  });
};

export const startGatewayServer = async (server: ApolloServer, port: number): Promise<string> => {
  const { url } = await startStandaloneServer(server, { listen: { port } });
  Logger.info(`Gateway running ${url}`);
  return url;
};
