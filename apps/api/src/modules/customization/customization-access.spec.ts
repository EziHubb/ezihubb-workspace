import { CustomizationService } from './customization.service';
import { NotFoundException } from '@nestjs/common';

describe('Private customization draft access', () => {
  const draft: { id: string; userId: string | null; sessionId: string; expiresAt: Date } = { id: 'draft', userId: 'owner', sessionId: 'cookie', expiresAt: new Date(Date.now() + 60000) };
  beforeEach(() => { draft.userId = 'owner'; draft.expiresAt = new Date(Date.now() + 60000); });
  function setup() {
    const findFirst = jest.fn(async ({ where }) => {
      const allowed = where.id === draft.id && ((where.userId !== null && where.userId === draft.userId) ||
        (draft.userId === null && where.userId === null && where.sessionId === draft.sessionId));
      return allowed && draft.expiresAt > where.expiresAt.gt ? draft : null;
    });
    const service = Object.create(CustomizationService.prototype) as CustomizationService;
    Object.assign(service, { prisma: { customizationDraft: { findFirst } } });
    return { service, findFirst };
  }
  it('allows owner only; cookie cannot override a signed-in identity', async () => {
    const { service } = setup();
    await expect(service.getDraftById('draft', 'owner', null)).resolves.toEqual(draft);
    await expect(service.getDraftById('draft', 'other', 'cookie')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getDraftById('draft', null, 'cookie')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects ID-only access before querying', async () => {
    const { service, findFirst } = setup();
    await expect(service.getDraftById('draft', null, null)).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).not.toHaveBeenCalled();
  });
  it('guest access is constrained to anonymous owner, session and expiry', async () => {
    const { service, findFirst } = setup();
    await expect(service.getDraftById('draft', null, 'guest-session')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'draft', userId: null, sessionId: 'guest-session', expiresAt: { gt: expect.any(Date) } } });
  });
  it('allows only the matching guest session, and refuses expired drafts', async () => {
    draft.userId = null;
    const { service } = setup();
    await expect(service.getDraftById('draft', null, 'cookie')).resolves.toEqual(draft);
    await expect(service.getDraftById('draft', null, 'wrong-cookie')).rejects.toBeInstanceOf(NotFoundException);
    draft.expiresAt = new Date(0);
    await expect(service.getDraftById('draft', null, 'cookie')).rejects.toBeInstanceOf(NotFoundException);
  });
});
