import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { releaseEconomicInventory } from '../products/inventory-reservation';
import { economicEnabled, economicMode } from './economic-checkout';
import { claimEconomicEvent, finishEconomicEvent, quarantineExhaustedEvents, quarantineExpiredOperations } from './economic-durability';
import { consumeVerifiedEconomics } from './economic-consumers';
import { consumeEconomicNotifications } from './economic-notifications';
import { externalEffectHash } from './economic-external-effect';

/** Bounded DB-only polling with fenced leases. No historical paid-order scan,
 * no provider writes, no silent replay of DEAD events. Default disabled. */
@Injectable()
export class EconomicDispatcherService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger=new Logger(EconomicDispatcherService.name);
  private timer:ReturnType<typeof setInterval>|null=null;
  private running=false;
  constructor(private readonly prisma:PrismaService,private readonly config:ConfigService) {}
  onApplicationBootstrap() {
    if (!this.enabled()) return;
    this.timer=setInterval(()=>{void this.tick().catch(()=>this.logger.error('Economic dispatcher tick failed; durable work retained'));},10_000);
    this.timer.unref();
  }
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);this.timer=null;}
  private enabled(){return economicEnabled() && this.config.get<string>('ECONOMIC_CONSUMERS_ENABLED')==='true';}
  async tick(){
    if(this.running || !this.enabled())return;
    this.running=true;
    try{
      const mode=economicMode();
      await quarantineExpiredOperations(this.prisma,new Date(),mode);
      await quarantineExhaustedEvents(this.prisma,new Date(),mode);
      const expired=await this.prisma.economicInventoryReservation.findMany({where:{state:'HELD',expiresAt:{lte:new Date()},context:{provenance:mode}},
        select:{contextId:true},distinct:['contextId'],orderBy:{expiresAt:'asc'},take:20});
      for(const row of expired){
        try{await releaseEconomicInventory(this.prisma,row.contextId,'EXPIRED');}
        catch{this.logger.warn(`Inventory release requires reconciliation: ${row.contextId}`);}
      }
      // Independent projection consumer: recovers already-published or audited
      // DEAD lifecycle events too. No historical orders or provider calls.
      const notifications = await this.prisma.economicOutbox.findMany({ where: {
        context: { provenance: mode }, eventType: { in: ['capture.verified.v1','refund.verified.v1'] },
        AND: [{ receipts: { some: { consumer: 'lifecycle.v1' } } }, { receipts: { none: { consumer: 'notifications.v1' } } }],
      }, orderBy: { createdAt: 'asc' }, take: 20 });
      const smtpAccount = externalEffectHash({ host: this.config.get<string>('email.host') ?? '', from: this.config.get<string>('email.from') ?? '' });
      for (const event of notifications) {
        try { await consumeEconomicNotifications(this.prisma, event, mode, smtpAccount); }
        catch { this.logger.warn(`Notification projection requires reconciliation: ${event.id}`); }
      }
      for(let count=0;count<20;count++){
        const event=await claimEconomicEvent(this.prisma,new Date(),mode);
        if(!event)break;
        const leaseToken=event.leaseToken;
        if(!leaseToken)throw new Error('Claimed economic event has no lease token');
        try{
          const context=await this.prisma.economicOrderContext.findUniqueOrThrow({where:{id:event.contextId}});
          if(context.provenance!==mode)throw new Error('Dispatcher mode mismatch');
          await consumeVerifiedEconomics(this.prisma,event,mode);
          await finishEconomicEvent(this.prisma,event.id,leaseToken,true);
        }catch{
          await finishEconomicEvent(this.prisma,event.id,leaseToken,false);
          this.logger.warn(`Economic event requires retry/reconciliation: ${event.id}`);
        }
      }
    }finally{this.running=false;}
  }
}
