// Owned worker only, never a standalone/background daemon. It stays responsive
// while the orchestrator runs synchronous Prisma/pg_dump child commands.
const { parentPort, workerData } = require('node:worker_threads');
const { createServer, connect } = require('node:net');
if (!parentPort) throw new Error('M5_RELAY_WORKER_REQUIRED');
const servers = [], sockets = new Set();
function stop() {
  for (const socket of sockets) socket.destroy();
  for (const server of servers) server.close();
}
parentPort.once('message', stop);
(async () => {
  for (const target of workerData) {
    const server = createServer(client => {
      const upstream = connect({ host: target.host, port: target.targetPort });
      for (const socket of [client, upstream]) {
        sockets.add(socket); socket.setTimeout(120_000, () => socket.destroy());
        socket.on('error', () => { client.destroy(); upstream.destroy(); });
        socket.once('close', () => { sockets.delete(socket); client.destroy(); upstream.destroy(); });
      }
      client.pipe(upstream); upstream.pipe(client);
    });
    servers.push(server);
    await new Promise((yes, no) => { server.once('error', no); server.listen(target.listenPort, '127.0.0.1', yes); });
    server.on('error', () => { stop(); parentPort.postMessage({ outcome: 'FAIL', code: 'M5_RELAY_LISTENER_FAILED' }); });
  }
  parentPort.postMessage({ outcome: 'READY', ports: servers.map(server => server.address().port) });
})().catch(() => { stop(); parentPort.postMessage({ outcome: 'FAIL', code: 'M5_RELAY_BIND_FAILED' }); });
