export interface GatewayConfig {
  port: number;
  subgraphs: { name: string; url: string }[];
}

const parsePort = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === '') return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid PORT "${value}"`);
  return port;
};

const parseUrl = (name: string, value: string): string => {
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`Invalid ${name} "${value}"`);
  }
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): GatewayConfig => ({
  port: parsePort(env.PORT, 4000),
  subgraphs: [
    {
      name: 'socket',
      url: parseUrl('SOCKET_SUBGRAPH_URL', env.SOCKET_SUBGRAPH_URL || 'http://localhost:4001/'),
    },
  ],
});
