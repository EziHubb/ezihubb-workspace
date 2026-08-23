import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * A shop's saved message bodies.
 *
 * Every method takes the store id as its first argument and every query is
 * filtered by it, so one shop can never read or edit another's — the same
 * shape the conversation labels beside them use.
 *
 * Distinct from StoreAutoReply, which sends itself on a timer. A snippet only
 * ever reaches a buyer because a seller picked it and pressed Send, which is
 * why it carries no scheduling of any kind.
 */

/** Matches `MessageSnippet.title`'s VARCHAR(120). */
const TITLE_MAX = 120;
/** Matches SendOrderMessageDto's own ceiling — a snippet that cannot be sent
 *  is not worth saving. */
const BODY_MAX = 5000;

@Injectable()
export class SnippetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string) {
    return this.prisma.messageSnippet.findMany({
      where:   { storeId },
      orderBy: { title: 'asc' },
    });
  }

  async create(storeId: string, title: string, body: string) {
    const clean = this.validate(title, body);

    // Caught rather than pre-checked: a read-then-write race between two tabs
    // would still hit the unique index, so the index is the real guard and
    // this only turns it into a sentence a person can read.
    try {
      return await this.prisma.messageSnippet.create({
        data: { storeId, ...clean },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('This shop already has a snippet with that name');
      }
      throw e;
    }
  }

  async update(storeId: string, snippetId: string, title: string, body: string) {
    const clean = this.validate(title, body);

    // updateMany with the store in the WHERE, not update by id: an update by
    // id would edit another shop's snippet and only then be told off.
    try {
      const { count } = await this.prisma.messageSnippet.updateMany({
        where: { id: snippetId, storeId },
        data:  clean,
      });
      if (!count) throw new NotFoundException('Snippet not found');
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('This shop already has a snippet with that name');
      }
      throw e;
    }

    return this.prisma.messageSnippet.findUnique({ where: { id: snippetId } });
  }

  async remove(storeId: string, snippetId: string) {
    const { count } = await this.prisma.messageSnippet.deleteMany({
      where: { id: snippetId, storeId },
    });
    if (!count) throw new NotFoundException('Snippet not found');
    return { deleted: true };
  }

  /**
   * Checked here as well as in the DTO. The DTO guards the HTTP edge; this
   * guards the method, which the panel and the inbox both reach — and a title
   * one character over the column width is a 500, not a validation error.
   */
  private validate(title: string, body: string) {
    const t = title.trim();
    const b = body.trim();
    if (!t) throw new BadRequestException('A snippet needs a name');
    if (!b) throw new BadRequestException('A snippet needs some text');
    if (t.length > TITLE_MAX) throw new BadRequestException(`A snippet name is at most ${TITLE_MAX} characters`);
    if (b.length > BODY_MAX)  throw new BadRequestException(`A snippet is at most ${BODY_MAX} characters`);
    return { title: t, body: b };
  }
}
