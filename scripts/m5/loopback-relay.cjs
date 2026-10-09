const { Worker } = require('node:worker_threads');
const { resolve } = require('node:path');
const { isIPv4 } = require('node:net');
const { PROJECT, PORTS, assertOwnedContainers } = require('./guard.cjs');

function relayTargets(containers, network) {
  assertOwnedContainers(containers);
  const name = `${PROJECT}_isolated`;
  if (network?.Name !== name || network.Internal !== true || network.Driver !== 'bridge'
    || network.Labels?.['com.docker.compose.project'] !== PROJECT || !/^[a-f0-9]{64}$/.test(network.Id ?? '')
    || JSON.stringify(Object.keys(network.Containers ?? {}).sort()) !== JSON.stringify(containers.map(row => row.Id).sort())) {
    throw new Error('M5_RELAY_NETWORK_IDENTITY');
  }
  const targets = [];
  for (const row of containers) {
    const attached = row.NetworkSettings?.Networks?.[name];
    const ip = attached?.IPAddress;
    // Literal, private Docker-assigned IP, cross-checked in both daemon views.
    if (Object.keys(row.NetworkSettings?.Networks ?? {}).length !== 1 || attached?.NetworkID !== network.Id
      || !isIPv4(ip ?? '') || !/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(ip)
      || network.Containers[row.Id]?.IPv4Address?.split('/')[0] !== ip) throw new Error('M5_RELAY_NETWORK_IDENTITY');
    const service = row.Config.Labels['com.docker.compose.service'];
    for (const [port, published] of Object.entries(PORTS[service])) {
      const actual = row.NetworkSettings?.Ports?.[port];
      if (actual != null && (!Array.isArray(actual) || actual.length !== 1 || actual[0].HostIp !== '127.0.0.1' || actual[0].HostPort !== published)) {
        throw new Error('M5_RELAY_PORT_IDENTITY');
      }
      // Engine versions differ on publishing ports without a default gateway.
      // When absent, relay only that port to the verified internal container.
      if (!actual) targets.push({ host: ip, targetPort: Number(port.split('/')[0]), listenPort: Number(published) });
    }
  }
  return targets;
}
async function withOwnedLoopbackRelays(containers, network, work) {
  const targets = relayTargets(containers, network);
  if (!targets.length) return work();
  const worker = new Worker(resolve(__dirname, 'loopback-relay-worker.cjs'), { workerData: targets, env: {}, execArgv: [] });
  let failed = false;
  worker.on('exit', () => { failed = true; });
  worker.on('error', () => { failed = true; });
  worker.on('message', result => { if (result?.outcome === 'FAIL') failed = true; });
  try {
    await new Promise((yes, no) => {
      const timer = setTimeout(() => no(new Error('M5_RELAY_START_TIMEOUT')), 10_000);
      worker.once('error', () => { clearTimeout(timer); no(new Error('M5_RELAY_START_FAILED')); });
      worker.once('exit', () => { clearTimeout(timer); no(new Error('M5_RELAY_START_FAILED')); });
      worker.once('message', result => {
        clearTimeout(timer);
        if (result?.outcome !== 'READY' || JSON.stringify(result.ports) !== JSON.stringify(targets.map(row => row.listenPort))) {
          no(new Error('M5_RELAY_BIND_FAILED')); return;
        }
        yes();
      });
    });
    const result = await work();
    if (failed) throw new Error('M5_RELAY_LISTENER_FAILED');
    return result;
  } finally { await worker.terminate(); }
}
module.exports = { relayTargets, withOwnedLoopbackRelays };
