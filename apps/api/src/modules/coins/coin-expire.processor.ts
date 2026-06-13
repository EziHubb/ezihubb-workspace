import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, JOBS } from '../../queue/queue.constants';
import { CoinService } from './coin.service';

@Processor(QUEUES.COINS)
export class CoinExpireProcessor extends WorkerHost {
  private readonly logger = new Logger(CoinExpireProcessor.name);

  constructor(private readonly coinService: CoinService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOBS.COIN_EXPIRE_DAILY) {
      this.logger.log('Running daily coin expiry job');
      await this.coinService.expireCoins();
    }
  }
}
