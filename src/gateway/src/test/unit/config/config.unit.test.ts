import { loadConfig } from '../../../config';

describe('gateway loadConfig', () => {
  it('defaults to port 4000 and a local socket subgraph', () => {
    expect(loadConfig({})).toEqual({
      port: 4000,
      subgraphs: [{ name: 'socket', url: 'http://localhost:4001/' }],
    });
  });

  it('reads PORT and SOCKET_SUBGRAPH_URL', () => {
    const config = loadConfig({ PORT: '5000', SOCKET_SUBGRAPH_URL: 'http://socket:4001/graphql' });
    expect(config.port).toBe(5000);
    expect(config.subgraphs[0].url).toBe('http://socket:4001/graphql');
  });

  it.each(['0', '70000', 'abc', '4.5'])('rejects PORT=%s', port => {
    expect(() => loadConfig({ PORT: port })).toThrow('Invalid PORT');
  });

  it('rejects a malformed subgraph URL', () => {
    expect(() => loadConfig({ SOCKET_SUBGRAPH_URL: 'not a url' })).toThrow('Invalid SOCKET_SUBGRAPH_URL');
  });
});
