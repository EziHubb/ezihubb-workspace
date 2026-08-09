import {
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
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
import { AuditLogService } from '../../common/services/audit-log.service';

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
    private readonly prisma:   PrismaService,
    private readonly auditLog: AuditLogService,
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
  async invite(@Req() req: Request, @Body() dto: InviteAdminDto, @CurrentUser() caller: JwtPayload) {
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
      subject: 'You have been invited to EziHubb Admin',
      template: 'team-invite',
      data: {
        email:        dto.email,
        tempPassword,
        role:         dto.role,
        invitedBy:    caller.email,
      },
    } satisfies SendEmailJobData);

    this.auditLog.log({
      userId:     caller.sub,
      action:     'INVITE_ADMIN',
      entityType: 'User',
      entityId:   user.id,
      after:      { email: dto.email, role: dto.role },
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });

    return {
      id:    user.id,
      email: user.email,
      role:  user.role,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin role' })
  async updateRole(
    @Req() req: Request,
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

    this.auditLog.log({
      userId:     caller.sub,
      action:     'UPDATE_ROLE',
      entityType: 'User',
      entityId:   id,
      before:     { role: member.role },
      after:      { role: dto.role },
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });

    return { id, role: dto.role };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke admin access (demote to CUSTOMER)' })
  async revoke(@Req() req: Request, @Param('id') id: string, @CurrentUser() caller: JwtPayload) {
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

    this.auditLog.log({
      userId:     caller.sub,
      action:     'REVOKE_ADMIN',
      entityType: 'User',
      entityId:   id,
      before:     { role: member.role },
      after:      { role: 'CUSTOMER' },
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
  }
}
