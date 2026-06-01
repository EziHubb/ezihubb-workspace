/**
 * DevBullModule — provides no-op queue stubs when DISABLE_QUEUE=true.
 *
 * When Redis isn't available in dev/CI, all @InjectQueue() tokens resolve
 * to a stub object that silently drops add() calls and returns empty arrays
 * for all getters. This lets the HTTP API start without Redis.
 */
import { DynamicModule, Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

function noopQueue(name: string) {
  return {
    name,
    add:        async () => ({ id: '0' }),
    addBulk:    async () => [],
    getJobs:    async () => [],
    getJob:     async () => null,
    getWaiting: async () => [],
    getActive:  async () => [],
    getFailed:  async () => [],
    count:      async () => 0,
    pause:      async () => {},
    resume:     async () => {},
    close:      async () => {},
    drain:      async () => {},
  };
}

@Module({})
export class DevBullModule {
  static forQueues(names: string[]): DynamicModule {
    const providers = names.map((name) => ({
      provide: getQueueToken(name),
      useValue: noopQueue(name),
    }));
    return {
      module:   DevBullModule,
      providers,
      exports:  providers.map((p) => p.provide),
    };
  }
}
