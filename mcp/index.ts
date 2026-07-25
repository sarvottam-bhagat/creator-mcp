import { createServer } from 'node:http';

import { readMcpConfig } from './config';
import { createMcpHttpApp } from './http';

const config = readMcpConfig(process.env);
const httpServer = createServer(createMcpHttpApp(config));

httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`EchoFM MCP server listening on port ${config.port}.`);
});

function shutdown() {
  httpServer.close((error) => {
    if (error) {
      console.error('EchoFM MCP shutdown failed.');
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
