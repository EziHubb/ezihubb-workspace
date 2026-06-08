import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SenderType } from '@prisma/client';
import { Role } from '@mlh/constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AdminConversationQueryDto } from './dto/admin-conversation-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { MessagesService } from './messages.service';

@ApiTags('Admin / Messages')
@Controller('admin/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations' })
  async listConversations(@Query() query: AdminConversationQueryDto) {
    return this.messagesService.adminListConversations(query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  async getConversation(@Param('id') id: string) {
    return this.messagesService.adminGetConversation(id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a reply from the shop' })
  async sendReply(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.sendMessage(id, SenderType.SHOP, user.sub, dto);
  }

  @Patch('conversations/:id/status')
  @ApiOperation({ summary: 'Update conversation status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateConversationStatusDto,
  ) {
    return this.messagesService.adminUpdateStatus(id, dto.status);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read (admin)' })
  async markRead(@Param('id') id: string) {
    return this.messagesService.markAdminRead(id);
  }
}
