import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TranslationService } from './translation.service';
import { AdminTranslationsController } from './admin-translations.controller';
import { AutoTranslateService } from './auto-translate.service';
import { TranslationProcessor } from '../../queue/translation.processor';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Global()
@Module({
  imports: [
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.TRANSLATIONS])]
      : [BullModule.registerQueue({ name: QUEUES.TRANSLATIONS })]),
  ],
  controllers: [AdminTranslationsController],
  providers: [
    TranslationService,
    AutoTranslateService,
    ...(disableQueue ? [] : [TranslationProcessor]),
  ],
  exports: [TranslationService, AutoTranslateService],
})
export class TranslationsModule {}
