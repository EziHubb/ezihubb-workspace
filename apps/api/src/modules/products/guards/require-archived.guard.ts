import { CanActivate, ExecutionContext, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductStatus } from '@prisma/client';

/**
 * Second, independent enforcement layer for the "must archive before delete"
 * rule — ProductsService.delete() already checks this itself, but a guard
 * runs before the controller method even executes and stays enforced even if
 * a future change to the service method's internals drops its own check.
 * Hard delete is irreversible, so this rule gets two separate code paths
 * rather than relying on a single point of enforcement.
 */
@Injectable()
export class RequireArchivedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const id = req.params['id'];

    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!product) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    }
    if (product.status !== ProductStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'ERR_MUST_ARCHIVE_FIRST',
        message: 'Archive this product before deleting it permanently.',
      });
    }
    return true;
  }
}
