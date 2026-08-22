import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  // Anonymous write that ends up on a public product page. At the global
  // 300/min an IP could post 300 questions a minute onto a listing.
  @Throttle({ default: { ttl: 900_000, limit: 5 } })   // 5 per 15 min
  @Post('products/:slug/questions')
  @HttpCode(HttpStatus.CREATED)
  ask(@Param('slug') slug: string, @Body() dto: AskQuestionDto) {
    return this.qa.askQuestion(slug, dto);
  }

  // POST /questions/:id/upvote — mark answer as helpful
  // Looser than asking: a real visitor legitimately upvotes several answers in
  // one sitting. Still bounded, because nothing else stops one caller from
  // deciding which answer looks most helpful to everyone else.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })   // 20 per min
  @Post('questions/:id/upvote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async upvote(@Param('id') id: string): Promise<void> {
    return this.qa.upvote(id);
  }
}
