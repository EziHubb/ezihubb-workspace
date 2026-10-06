import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

describe('Realtime session revocation', () => {
  let gateway: RealtimeGateway;
  const prisma = { user: { findUnique: jest.fn() } };

  beforeEach(() => {
    gateway = new RealtimeGateway(
      { verifyAsync: jest.fn().mockResolvedValue({ sub: 'owner', role: 'ADMIN', sid: 'session', iat: 100 }) } as unknown as JwtService,
      { get: () => 'test-only-secret' } as unknown as ConfigService,
      prisma as unknown as PrismaService,
      { refresh: jest.fn().mockResolvedValue(undefined) } as unknown as PresenceService,
    );
  });
  afterEach(() => gateway.onModuleDestroy());

  function socket() {
    return { id: 'socket', handshake: { auth: { token: 'test-token' }, headers: {} }, disconnect: jest.fn() } as unknown as Socket;
  }

  it('refuses a revoked session during a new connection', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'owner', deletedAt: null, authSessions: [] });
    await expect(gateway['verify'](socket())).resolves.toBeNull();
  });

  it('allows an active session', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'owner', role: 'ADMIN', deletedAt: null, authSessions: [{ id: 'session' }] });
    await expect(gateway['verify'](socket())).resolves.toEqual({ userId: 'owner', role: 'ADMIN' });
  });

  it('disconnects idle sockets when their session has been revoked', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'owner', deletedAt: null, authSessions: [] });
    const client = socket();
    gateway['connectedSockets'].set(client.id, client);
    await gateway['checkConnectedSessions']();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('rejects a correctly signed pending MFA token before querying user data', async () => {
    const jwt = new JwtService({ secret: 'test-only-secret' });
    gateway.onModuleDestroy();
    gateway = new RealtimeGateway(jwt, { get: () => 'test-only-secret' } as unknown as ConfigService,
      prisma as unknown as PrismaService, {} as PresenceService);
    prisma.user.findUnique.mockClear();
    const client = socket();
    client.handshake.auth.token = jwt.sign({ sub: 'owner', role: 'ADMIN', purpose: 'totp-pending' });
    await expect(gateway['verify'](client)).resolves.toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('disconnects a demoted user even when the session remains active', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'owner', role: 'CUSTOMER', authSessions: [{ id: 'session' }] });
    const client = socket();
    gateway['connectedSockets'].set(client.id, client);
    await gateway['checkConnectedSessions']();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
