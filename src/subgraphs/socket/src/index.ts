// The agent must be loaded before any other module; it is enabled only when a license key is configured.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (process.env.NEW_RELIC_LICENSE_KEY) require('newrelic');

import cron, { ScheduledTask } from 'node-cron';
import { loadConfig } from './config';
import { connectMongo, createSubgraphServer, disconnectMongo, startSubgraphServer } from './app';
import { pullSocket } from './cron';
import { Logger } from './util';

const main = async (): Promise<void> => {
  const config = loadConfig();
  await connectMongo(config.mongoUri);
  const server = createSubgraphServer();
  await startSubgraphServer(server, config.port);

  const abortController = new AbortController();
  let task: ScheduledTask | undefined;

  if (config.openChargeMapApiKey) {
    const sync = async (): Promise<void> => {
      try {
        await pullSocket({
          apiKey: config.openChargeMapApiKey,
          baseUrl: config.openChargeMapBaseUrl,
          countries: config.syncCountries,
          signal: abortController.signal,
        });
      } catch (err) {
        Logger.error('Socket sync failed:- ', err);
      }
    };
    task = cron.schedule(config.syncSchedule, sync, { name: 'socket-sync', noOverlap: true });
    if (config.syncOnStart) void sync();
  } else {
    Logger.warn('OPEN_CHARGE_MAP_API_KEY is not set: socket sync is disabled');
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    Logger.info(`${signal} received, shutting down`);
    try {
      await task?.destroy();
      abortController.abort();
      await server.stop();
      await disconnectMongo();
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
  Logger.error('Socket subgraph failed to start:- ', err);
  process.exit(1);
});
