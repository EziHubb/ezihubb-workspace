const { assertDatabaseIdentity, assertEnvironment, DATABASES, PORTS } = require('./guard.cjs');

function assertPublishedPorts(containers) {
  for (const container of containers) {
    const service = container.Config?.Labels?.['com.docker.compose.service'];
    const actual = container.NetworkSettings?.Ports ?? {};
    if (!PORTS[service] || Object.entries(PORTS[service]).some(([port, expected]) =>
      !Array.isArray(actual[port]) || actual[port].length !== 1
      || actual[port][0].HostIp !== '127.0.0.1' || actual[port][0].HostPort !== expected)) {
      // HostConfig can declare ports which Engine has not actually published.
      throw new Error('M5_HOST_PORT_NOT_PUBLISHED');
    }
  }
}
async function waitForDatabaseIdentity(pool, env, database, sleep = ms => new Promise(done => setTimeout(done, ms))) {
  assertEnvironment(env);
  if (!DATABASES.includes(database)) throw new Error('M5_DATABASE_IDENTITY');
  for (let attempt = 0; ; attempt++) {
    try { await assertDatabaseIdentity(pool, env, database); return; }
    catch (error) {
      if (attempt >= 59 || !['ECONNREFUSED', 'ECONNRESET', '57P03'].includes(error.code)) throw error;
      await sleep(1000);
    }
  }
}
module.exports = { assertPublishedPorts, waitForDatabaseIdentity };
