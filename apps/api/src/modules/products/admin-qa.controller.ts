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
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { QaService } from './qa.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { ConfigService } from '@nestjs/config';

class AnswerDto {
  @IsString() @MaxLength(5000) answer: string;
  @IsOptional() @IsBoolean() publish?: boolean;
}

class PatchQuestionDto {
  @IsOptional() @IsString() @MaxLength(5000) answer?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

@AdminController('')
export class AdminQaController {
  constructor(
    private readonly qa: QaService,
    private readonly config: ConfigService,
  ) {}

  // GET /admin/questions/unanswered-count
  @Get('questions/unanswered-count')
  async unansweredCount() {
    const count = await this.qa.getUnansweredCount();
    return { count };
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
    @Param('qId') qId: string,
    @Body() dto: AnswerDto,
  ) {
    const shopBaseUrl = this.config.get<string>('NEXT_PUBLIC_URL') ?? 'https://dailydaisy.com';
    return this.qa.answerQuestion(qId, dto, shopBaseUrl);
  }

  // PATCH /admin/products/:id/questions/:qId
  @Patch('products/:id/questions/:qId')
  patch(
    @Param('qId') qId: string,
    @Body() dto: PatchQuestionDto,
  ) {
    return this.qa.patchQuestion(qId, dto);
  }

  // DELETE /admin/products/:id/questions/:qId
  @Delete('products/:id/questions/:qId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('qId') qId: string): Promise<void> {
    return this.qa.moderateQuestion(qId, 'delete');
  }

  // POST /admin/products/:id/questions/:qId/spam
  @Post('products/:id/questions/:qId/spam')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markSpam(@Param('qId') qId: string): Promise<void> {
    return this.qa.moderateQuestion(qId, 'spam');
  }
}
