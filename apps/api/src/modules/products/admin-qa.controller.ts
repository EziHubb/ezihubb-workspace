import {
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QaService, type AdminQuestionInboxQuery } from './qa.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { ConfigService } from '@nestjs/config';
import { ProductOwnershipGuard } from '../../common/guards/product-ownership.guard';
import { StoreContextService } from '../../common/services/store-context.service';

class AnswerDto {
  @IsString() @MaxLength(5000) answer: string;
  @IsOptional() @IsBoolean() publish?: boolean;
}

class PatchQuestionDto {
  @IsOptional() @IsString() @MaxLength(5000) answer?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class QuestionInboxQueryDto implements AdminQuestionInboxQuery {
  @IsOptional() @IsIn(['all', 'unanswered', 'answered'])
  filter?: 'all' | 'unanswered' | 'answered' = 'all';

  @IsOptional() @IsString() @MaxLength(200)
  q?: string;

  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(48)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  limit?: number = 24;
}

// ProductOwnershipGuard runs after JwtAuthGuard from AdminController and
// validates every products/:id route. Global questions routes have no :id and
// scope themselves through StoreContextService below.
@UseGuards(ProductOwnershipGuard)
@AdminController('')
export class AdminQaController {
  constructor(
    private readonly qa: QaService,
    private readonly config: ConfigService,
    private readonly storeContext: StoreContextService,
  ) {}

  // GET /admin/questions/unanswered-count
  @Get('questions/unanswered-count')
  async unansweredCount(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const count = await this.qa.getUnansweredCount(context.storeId ?? undefined);
    return { count };
  }

  // GET /admin/questions — centralized seller/platform inbox
  @Get('questions')
  async inbox(@Req() req: Request, @Query() query: QuestionInboxQueryDto) {
    const context = await this.storeContext.resolve(req);
    return this.qa.getAdminQuestionInbox(query, context.storeId ?? undefined);
  }

  // GET /admin/products/:id/questions
  @Get('products/:id/questions')
  getAll(
    @Param('id') id: string,
    @Query('filter') filter?: 'all' | 'unanswered',
  ) {
    return this.qa.getAdminQuestions(id, filter);
  }

  // POST /admin/products/:id/questions/:qId/answer
  @Post('products/:id/questions/:qId/answer')
  answer(
    @Param('id') productId: string,
    @Param('qId') qId: string,
    @Body() dto: AnswerDto,
  ) {
    const shopBaseUrl = this.config.get<string>('NEXT_PUBLIC_URL') ?? 'https://ezihubb.com';
    return this.qa.answerQuestion(productId, qId, dto, shopBaseUrl);
  }

  // PATCH /admin/products/:id/questions/:qId
  @Patch('products/:id/questions/:qId')
  patch(
    @Param('id') productId: string,
    @Param('qId') qId: string,
    @Body() dto: PatchQuestionDto,
  ) {
    return this.qa.patchQuestion(productId, qId, dto);
  }

  // DELETE /admin/products/:id/questions/:qId
  @Delete('products/:id/questions/:qId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') productId: string,
    @Param('qId') qId: string,
  ): Promise<void> {
    return this.qa.moderateQuestion(productId, qId, 'delete');
  }

  // POST /admin/products/:id/questions/:qId/spam
  @Post('products/:id/questions/:qId/spam')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markSpam(
    @Param('id') productId: string,
    @Param('qId') qId: string,
  ): Promise<void> {
    return this.qa.moderateQuestion(productId, qId, 'spam');
  }
}
