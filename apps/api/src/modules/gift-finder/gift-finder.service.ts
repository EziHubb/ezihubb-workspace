import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { randomBytes } from 'crypto';

const QUIZ_QUESTIONS = [
  { id: 'relationship', text: 'Who are you buying for?', options: ['Partner', 'Parent', 'Sibling', 'Friend', 'Colleague', 'Child'] },
  { id: 'age_group',   text: 'What age group?',          options: ['Under 18', '18-25', '26-35', '36-50', '51-65', '65+'] },
  { id: 'interests',   text: 'What are their interests?', options: ['Art & Craft', 'Tech & Gaming', 'Home & Garden', 'Fashion', 'Books & Learning', 'Sports & Outdoors'] },
  { id: 'occasion',    text: 'What is the occasion?',     options: ['Birthday', 'Anniversary', 'Holiday', 'Thank You', 'Just Because', 'Graduation'] },
  { id: 'budget',      text: 'What is your budget?',      options: ['Under $25', '$25-$50', '$50-$100', '$100-$200', 'Over $200'] },
];

type Session = {
  sessionToken: string;
  userId?: string;
  dbId?: string;
  currentStep: number;
  answers: Record<string, string>;
};

@Injectable()
export class GiftFinderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  startSession(userId?: string) {
    const sessionToken = randomBytes(16).toString('hex');
    const session: Session = { sessionToken, userId, currentStep: 0, answers: {} };
    this.redis.set(`gift-finder:${sessionToken}`, session, 3600).catch(() => {});
    return { sessionToken, currentStep: 0, question: QUIZ_QUESTIONS[0], totalSteps: QUIZ_QUESTIONS.length };
  }

  async processStep(sessionToken: string, answer: string) {
    const session = await this.redis.get<Session>(`gift-finder:${sessionToken}`);
    if (!session) throw new NotFoundException('Session not found or expired');

    const currentQ = QUIZ_QUESTIONS[session.currentStep];
    if (!currentQ) throw new NotFoundException('Invalid step');
    session.answers[currentQ.id] = answer;
    session.currentStep++;

    if (session.currentStep >= QUIZ_QUESTIONS.length) {
      // All answered — persist to DB, use Redis ID for follow-up lookups
      const dbSession = await this.prisma.giftFinderSession.create({
        data: {
          buyerId:            session.userId ?? null,
          quizAnswers:        session.answers,
          recommendedProducts: [],
          convertedToOrder:   false,
        },
      });
      session.dbId = dbSession.id;
      await this.redis.set(`gift-finder:${sessionToken}`, session, 3600);
      return { done: true, sessionToken };
    }

    await this.redis.set(`gift-finder:${sessionToken}`, session, 3600);
    return {
      done:        false,
      sessionToken,
      currentStep: session.currentStep,
      question:    QUIZ_QUESTIONS[session.currentStep],
      totalSteps:  QUIZ_QUESTIONS.length,
    };
  }

  async getResults(sessionToken: string) {
    const session = await this.redis.get<Session>(`gift-finder:${sessionToken}`);
    if (!session?.dbId) throw new NotFoundException('Session not found or results not ready');

    const dbSession = await this.prisma.giftFinderSession.findUnique({ where: { id: session.dbId } });
    if (!dbSession) throw new NotFoundException('Session not found');

    const answers = session.answers;
    const budgetMap: Record<string, [number, number]> = {
      'Under $25':  [0,   25],
      '$25-$50':    [25,  50],
      '$50-$100':   [50,  100],
      '$100-$200':  [100, 200],
      'Over $200':  [200, 99999],
    };
    const [minPrice, maxPrice] = budgetMap[answers['budget'] ?? ''] ?? [0, 99999];

    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE', basePrice: { gte: minPrice, lte: maxPrice } },
      take:    8,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, slug: true, basePrice: true,
        images: { take: 1 },
        store: { select: { name: true, slug: true } },
      },
    });

    await this.prisma.giftFinderSession.update({
      where: { id: session.dbId },
      data:  { recommendedProducts: products.map(p => p.id) },
    });

    return { products, answers };
  }
}
