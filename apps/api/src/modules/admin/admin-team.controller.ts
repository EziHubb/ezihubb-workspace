import {
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS, SendEmailJobData } from '../../queue/queue.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

class InviteAdminDto {
  @IsEmail()
  email!: string;

  @IsIn(ADMIN_ROLES)
  role!: AdminRole;
}

class UpdateRoleDto {
  @IsIn(ADMIN_ROLES)
  role!: AdminRole;
}

@AdminController('team')
export class AdminTeamController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all admin team members' })
  async list() {
    const members = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        lastLoginAt: true,
      },
    });

    return members.map((m) => ({
      id: m.id,
      name: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email,
      email: m.email,
      role: m.role as AdminRole,
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
    }));
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a new admin (creates account + sends temp-password email)' })
  async invite(@Body() dto: InviteAdminDto, @CurrentUser() caller: JwtPayload) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException(`A user with email ${dto.email} already exists`);
    }

    const tempPassword = randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        isEmailVerified: true,
        isActive: true,
      },
    });

    await this.emailQueue.add(JOBS.SEND_EMAIL, {
      to: dto.email,
      subject: 'You have been invited to DailyDaisy Admin',
      template: 'team-invite',
      data: {
        email:        dto.email,
        tempPassword,
        role:         dto.role,
        invitedBy:    caller.email,
      },
    } satisfies SendEmailJobData);

    return {
      id:    user.id,
      email: user.email,
      role:  user.role,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin role' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() caller: JwtPayload,
  ) {
    if (id === caller.sub) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const member = await this.prisma.user.findFirst({
      where: { id, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Admin member not found');

    await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });

    return { id, role: dto.role };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke admin access (demote to CUSTOMER)' })
  async revoke(@Param('id') id: string, @CurrentUser() caller: JwtPayload) {
    if (id === caller.sub) {
      throw new ForbiddenException('Cannot revoke your own admin access');
    }

    const member = await this.prisma.user.findFirst({
      where: { id, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Admin member not found');

    await this.prisma.user.update({
      where: { id },
      data: { role: 'CUSTOMER' },
    });
  }
}
