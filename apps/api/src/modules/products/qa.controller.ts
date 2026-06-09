import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QaService, AskQuestionDto } from './qa.service';

@Controller()
export class QaController {
  constructor(private readonly qa: QaService) {}

  // GET /products/:slug/questions — published Q&As (SEO-friendly)
  @Get('products/:slug/questions')
  getPublished(@Param('slug') slug: string) {
    return this.qa.getPublishedQAs(slug);
  }

  // POST /products/:slug/questions — ask a question
  @Post('products/:slug/questions')
  @HttpCode(HttpStatus.CREATED)
  ask(@Param('slug') slug: string, @Body() dto: AskQuestionDto) {
    return this.qa.askQuestion(slug, dto);
  }

  // POST /questions/:id/upvote — mark answer as helpful
  @Post('questions/:id/upvote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async upvote(@Param('id') id: string): Promise<void> {
    return this.qa.upvote(id);
  }
}
