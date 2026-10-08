const { generateKeyPairSync, randomBytes, sign, X509Certificate } = require('node:crypto');

// Ephemeral loopback-only test certificate. No OpenSSL, committed private key,
// filesystem export, trust-store installation or global TLS bypass is needed.
function der(tag, value) {
  const size = value.length;
  const length = size < 128 ? Buffer.from([size]) : (() => {
    let hex = size.toString(16); if (hex.length % 2) hex = `0${hex}`;
    const bytes = Buffer.from(hex, 'hex'); return Buffer.concat([Buffer.from([128 + bytes.length]), bytes]);
  })();
  return Buffer.concat([Buffer.from([tag]), length, value]);
}
const sequence = (...parts) => der(0x30, Buffer.concat(parts));
const oid = hex => der(0x06, Buffer.from(hex, 'hex'));
function pem(label, value) {
  return `-----BEGIN ${label}-----\n${value.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
}
function createLoopbackCertificate() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const algorithm = sequence(oid('2a864886f70d01010b'), der(0x05, Buffer.alloc(0)));
  const name = sequence(der(0x31, sequence(oid('550403'), der(0x0c, Buffer.from('M5 ephemeral loopback')))));
  const timestamp = date => der(0x18, Buffer.from(date.toISOString().replace(/[-:T]/g, '').replace(/\.\d{3}/, '')));
  const serial = randomBytes(16); serial[0] &= 0x7f; serial[0] |= 1;
  const alternatives = sequence(der(0x82, Buffer.from('localhost')), der(0x87, Buffer.from([127, 0, 0, 1])));
  const extensions = der(0xa3, sequence(sequence(oid('551d11'), der(0x04, alternatives))));
  const body = sequence(der(0xa0, der(0x02, Buffer.from([2]))), der(0x02, serial), algorithm, name,
    sequence(timestamp(new Date(Date.now() - 60_000)), timestamp(new Date(Date.now() + 3_600_000))), name,
    publicKey.export({ type: 'spki', format: 'der' }), extensions);
  const cert = pem('CERTIFICATE', sequence(body, algorithm, der(0x03, Buffer.concat([Buffer.from([0]), sign('sha256', body, privateKey)]))));
  const parsed = new X509Certificate(cert);
  if (!parsed.verify(publicKey) || !parsed.checkIP('127.0.0.1') || !parsed.checkHost('localhost')) throw new Error('M5_TLS_CERTIFICATE');
  return { key: privateKey.export({ type: 'pkcs8', format: 'pem' }), cert, minVersion: 'TLSv1.2' };
}
module.exports = { createLoopbackCertificate };
