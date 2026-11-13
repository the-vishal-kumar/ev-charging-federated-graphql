// The agent must load before any other module; it is enabled only when a licence key is configured.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (process.env.NEW_RELIC_LICENSE_KEY) require('newrelic');

import { createGatewayServer, startGatewayServer } from './app';
import { loadConfig } from './config';
import { Logger } from './util';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const server = createGatewayServer(config.subgraphs);
  await startGatewayServer(server, config.port);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    Logger.info(`${signal} received, shutting down`);
    try {
      await server.stop();
      process.exit(0);
    } catch (err) {
      Logger.error('Error during shutdown:- ', err);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

main().catch((err: unknown) => {
  Logger.error('Gateway failed to start:- ', err);
  process.exit(1);
});
