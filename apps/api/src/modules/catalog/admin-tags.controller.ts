import {
  Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus,
  ConflictException, NotFoundException,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';

class TagBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

@Roles(Role.SUPER_ADMIN)
@AdminController('tags')
export class AdminTagsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all tags with product counts' })
  async list() {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return tags.map((t) => ({
      id:           t.id,
      name:         t.name,
      slug:         t.slug,
      productCount: t._count.products,
    }));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a tag' })
  async create(@Body() dto: TagBodyDto) {
    const slug = toSlug(dto.name);
    const existing = await this.prisma.tag.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });
    if (existing) throw new ConflictException(`Tag "${dto.name}" already exists`);
    return this.prisma.tag.create({ data: { name: dto.name, slug } });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a tag' })
  async update(@Param('id') id: string, @Body() dto: TagBodyDto) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');

    const slug = toSlug(dto.name);
    const conflict = await this.prisma.tag.findFirst({
      where: { OR: [{ name: dto.name }, { slug }], NOT: { id } },
    });
    if (conflict) throw new ConflictException(`Tag "${dto.name}" already exists`);

    return this.prisma.tag.update({ where: { id }, data: { name: dto.name, slug } });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag (removes from all products)' })
  async delete(@Param('id') id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    // ProductTag rows cascade-deleted via FK onDelete: Cascade
    await this.prisma.tag.delete({ where: { id } });
  }
}
