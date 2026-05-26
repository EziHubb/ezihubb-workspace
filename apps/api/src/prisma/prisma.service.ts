import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

// Models that support soft delete via deletedAt
const SOFT_DELETE_MODELS = new Set(['User', 'Product']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });

    // Intercept delete → soft delete for supported models
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      if (params.model && SOFT_DELETE_MODELS.has(params.model)) {
        if (params.action === 'delete') {
          params.action = 'update';
          params.args['data'] = { deletedAt: new Date() };
        } else if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          if (!params.args['data']) params.args['data'] = {};
          params.args['data']['deletedAt'] = new Date();
        } else if (
          ['findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'].includes(params.action)
        ) {
          if (!params.args) params.args = {};
          if (!params.args['where']) params.args['where'] = {};
          params.args['where']['deletedAt'] = null;
        }
      }
      return next(params);
    });
  }

  async onModuleInit() {
    if (process.env.NODE_ENV === 'development') {
      (this as unknown as { $on: (event: string, cb: (e: Prisma.QueryEvent) => void) => void }).$on(
        'query',
        (e: Prisma.QueryEvent) => {
          this.logger.debug(`[${e.duration}ms] ${e.query}`);
        },
      );
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
