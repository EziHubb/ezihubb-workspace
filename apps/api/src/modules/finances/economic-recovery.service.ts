import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EconomicProvenance, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { economicTransaction } from './economic-balance';
import { economicEnabled, economicMode } from './economic-checkout';
import { applyVerifiedEconomicLifecycle } from './economic-consumers';
import { ECONOMIC_POLICY_VERSION } from './economic-policy';
import { EconomicHistoryQueryDto } from './dto/economic-finances.dto';

@Injectable()
export class EconomicRecoveryService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  private enabled(provenance: EconomicProvenance) {
    return economicEnabled() && this.config.get<string>('ECONOMIC_CONSUMERS_ENABLED') === 'true' && economicMode() === provenance;
  }
  async list(query: EconomicHistoryQueryDto) {
    const where: Prisma.EconomicOutboxWhereInput = { state: 'DEAD', eventType: { in: ['capture.verified.v1','refund.verified.v1'] },
      context: { currency: query.currency, provenance: query.provenance, policyVersion: ECONOMIC_POLICY_VERSION } };
    return this.prisma.$transaction(async tx => {
      const total = await tx.economicOutbox.count({ where });
      const rows = await tx.economicOutbox.findMany({ where, take: query.limit, skip: (query.page - 1) * query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { lifecycleRecovery: true,
          context: { select: { orderId: true, order: { select: { orderNumber: true } } } } } });
      return { version: 'economic-v1', provenance: query.provenance, currency: query.currency,
        recoveryEnabled: this.enabled(query.provenance), total, page: query.page, limit: query.limit,
        data: rows.map(row => ({ id: row.id, eventType: row.eventType, state: row.state, attempts: row.attempts,
          orderId: row.context.orderId, orderNumber: row.context.order.orderNumber, createdAt: row.createdAt,
          recovery: row.lifecycleRecovery ? { actorId: row.lifecycleRecovery.actorId, reason: row.lifecycleRecovery.reason,
            applied: row.lifecycleRecovery.applied, createdAt: row.lifecycleRecovery.createdAt } : null })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async recover(eventId: string, actorId: string, provenance: EconomicProvenance, reason: string) {
    if (!this.enabled(provenance)) throw new BadRequestException('Economic lifecycle recovery is not enabled for this mode');
    if (!actorId.trim() || reason !== reason.trim() || !reason || reason.length > 500) throw new BadRequestException('Recovery actor and reason are required');
    return economicTransaction(this.prisma, async tx => {
      await tx.$queryRaw`SELECT "id" FROM "EconomicOutbox" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.economicOutbox.findUnique({ where: { id: eventId }, include: { context: true, lifecycleRecovery: true } });
      if (!event || event.context.provenance !== provenance || event.context.currency !== 'USD') throw new NotFoundException('Event not found in this mode');
      if (event.context.policyVersion !== ECONOMIC_POLICY_VERSION) throw new ConflictException('Unsupported lifecycle policy');
      if (event.state !== 'DEAD') throw new ConflictException('Only a terminal DEAD event can be recovered');
      if (event.lifecycleRecovery) return { id: event.lifecycleRecovery.id, applied: event.lifecycleRecovery.applied, alreadyRecovered: true };
      if (!['capture.verified.v1','refund.verified.v1'].includes(event.eventType)) throw new ConflictException('Unsupported lifecycle event');
      const receipt = await tx.economicConsumerReceipt.createMany({ data: [{ eventId, consumer: 'lifecycle.v1' }], skipDuplicates: true });
      if (receipt.count) await applyVerifiedEconomicLifecycle(tx, event, provenance);
      const recovery = await tx.economicLifecycleRecovery.create({ data: { eventId, actorId, reason, applied: receipt.count === 1 } });
      // Do not touch DEAD, counters, provider operation or immutable capture.
      return { id: recovery.id, applied: recovery.applied, alreadyRecovered: false };
    });
  }
}
