const net = require('node:net');
const { appendFileSync, lstatSync } = require('node:fs');
const { resolve } = require('node:path');
const { syncBuiltinESMExports } = require('node:module');

function connectionOptions(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (first && typeof first === 'object') return first;
  if (typeof first === 'number') return { port: first, host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  return { path: first };
}
function allowedConnection(options, ownedPorts, fixturePort) {
  const port = Number(options.port), host = options.host ?? 'localhost';
  if (options.path) return false;
  if (['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) return ownedPorts.has(port) || port === fixturePort;
  // Production fonts are downloaded as-is; no fake font response or TLS bypass.
  return port === 443 && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(host);
}
function installPolicy(fixturePort, privateDirectory) {
  if (!Number.isSafeInteger(fixturePort) || fixturePort < 1024 || fixturePort > 65535
    || !lstatSync(privateDirectory).isDirectory() || lstatSync(privateDirectory).isSymbolicLink()) throw new Error('M5_REGRESSION_NETWORK_CONFIG');
  const audit = resolve(privateDirectory, 'network-denials.txt');
  if (!lstatSync(audit).isFile() || lstatSync(audit).isSymbolicLink()) throw new Error('M5_REGRESSION_NETWORK_CONFIG');
  const ownedPorts = new Set(), originalConnect = net.Socket.prototype.connect, originalListen = net.Server.prototype.listen;
  net.Server.prototype.listen = function (...args) {
    this.prependOnceListener('listening', () => {
      const address = this.address();
      if (address && typeof address === 'object') {
        ownedPorts.add(address.port);
        this.once('close', () => ownedPorts.delete(address.port));
      }
    });
    return originalListen.apply(this, args);
  };
  net.Socket.prototype.connect = function (...args) {
    if (!allowedConnection(connectionOptions(args), ownedPorts, fixturePort)) {
      // Fixed marker only: never URLs, headers, token, driver error or PII.
      appendFileSync(audit, 'DENIED\n', { mode: 0o600 });
      throw new Error('M5_REGRESSION_EGRESS_DENIED');
    }
    return originalConnect.apply(this, args);
  };
  syncBuiltinESMExports();
}
if (require.main !== module && process.env.M5_REGRESSION_FIXTURE_PORT) {
  installPolicy(Number(process.env.M5_REGRESSION_FIXTURE_PORT), process.env.M5_REGRESSION_PRIVATE_DIRECTORY);
}
module.exports = { connectionOptions, allowedConnection, installPolicy };
