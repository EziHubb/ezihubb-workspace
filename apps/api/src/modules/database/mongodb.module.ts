import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

function dohFetch(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { accept: 'application/dns-json' } }, (res) => {
        let data = '';
        res.on('data', (c: Buffer) => (data += c.toString()));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      })
      .on('error', reject);
  });
}

async function resolveMongoSrvUri(originalUri: string): Promise<string> {
  if (!originalUri.startsWith('mongodb+srv://')) return originalUri;
  try {
    const url  = new URL(originalUri.replace('mongodb+srv://', 'https://'));
    const host = url.hostname;
    const [srvResp, txtResp] = await Promise.all([
      dohFetch(`https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`),
      dohFetch(`https://dns.google/resolve?name=${host}&type=TXT`),
    ]);
    const srvAnswers = ((srvResp['Answer'] ?? []) as { type: number; data: string }[])
      .filter((r) => r.type === 33);
    if (!srvAnswers.length) return originalUri;
    const hosts = srvAnswers
      .map((r) => { const p = r.data.trim().split(/\s+/); return `${p[3].replace(/\.$/, '')}:${p[2]}`; })
      .join(',');
    const txtAnswers = ((txtResp['Answer'] ?? []) as { type: number; data: string }[])
      .filter((r) => r.type === 16);
    const txtOptions = txtAnswers.map((r) => r.data.replace(/^"|"$/g, '').replace(/"\s*"/g, '')).join('&') || 'authSource=admin';
    const creds  = `${url.username}:${encodeURIComponent(decodeURIComponent(url.password))}`;
    const extraQs = url.search ? url.search.slice(1) : '';
    const qs = [txtOptions, 'tls=true', extraQs].filter(Boolean).join('&');
    return `mongodb://${creds}@${hosts}/?${qs}`;
  } catch { return originalUri; }
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async (config: ConfigService) => {
        const rawUri = config.get<string>('MONGODB_URI') ?? 'mongodb://localhost:27017';
        const uri    = await resolveMongoSrvUri(rawUri);
        return { uri, dbName: 'dailydaisy', maxPoolSize: 10, connectTimeoutMS: 10_000, serverSelectionTimeoutMS: 10_000 };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class MongoDBModule {}
