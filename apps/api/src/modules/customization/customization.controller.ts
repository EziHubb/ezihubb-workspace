import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CustomizationService } from './customization.service';
import { GeneratePreviewDto } from './dto/generate-preview.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { UploadedImageDto } from './dto/upload-result.dto';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CustomizationDraft } from '@prisma/client';

@ApiTags('customization')
@Controller('customization')
@UseGuards(OptionalAuthGuard)
export class CustomizationController {
  constructor(private readonly customizationService: CustomizationService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload an image for customization (max 10 MB, JPEG/PNG/WebP/HEIC)',
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadedImageDto> {
    if (!file) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'No image file provided',
      });
    }
    return this.customizationService.uploadImage(file);
  }

  @Post('remove-background')
  @ApiOperation({
    summary: 'Queue background removal for an uploaded image (async, ~60s)',
  })
  async removeBackground(
    @Body('tempKey') tempKey: string,
    @Body('draftId') draftId: string,
  ): Promise<{ jobId: string }> {
    if (!tempKey) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'tempKey is required',
      });
    }
    return this.customizationService.removeBackground(
      tempKey,
      draftId ?? 'temp',
    );
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Poll the status of an image processing job' })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<{ status: string; result?: string; error?: string }> {
    return this.customizationService.getJobStatus(jobId);
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Queue preview generation for a customization draft',
  })
  async generatePreview(
    @Body() dto: GeneratePreviewDto,
  ): Promise<{ jobId: string }> {
    return this.customizationService.generatePreview(dto);
  }

  @Post('art-style')
  @ApiOperation({
    summary: 'Queue an art style transformation for an uploaded image',
  })
  async applyArtStyle(
    @Body('tempKey') tempKey: string,
    @Body('style') style: string,
    @Body('draftId') draftId: string,
  ): Promise<{ jobId: string }> {
    if (!tempKey || !style) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'tempKey and style are required',
      });
    }
    return this.customizationService.applyArtStyle(
      tempKey,
      style,
      draftId ?? 'temp',
    );
  }

  @Post('draft')
  @ApiOperation({
    summary:
      'Save or update a customization draft (upsert by user/session + product + template)',
  })
  async saveDraft(
    @Body() dto: SaveDraftDto,
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
  ): Promise<CustomizationDraft> {
    const userId = user?.sub ?? null;
    const sessionId =
      (req.cookies as Record<string, string>)['cart_session'] ?? null;
    return this.customizationService.saveCustomizationDraft(
      userId,
      sessionId,
      dto,
    );
  }

  @Get('draft')
  @ApiOperation({
    summary: 'Retrieve the latest customization draft for a product',
  })
  @ApiQuery({ name: 'productId', required: true })
  async getLastDraft(
    @Query('productId') productId: string,
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
  ): Promise<CustomizationDraft | null> {
    if (!productId) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'productId is required',
      });
    }
    const userId = user?.sub ?? null;
    const sessionId =
      (req.cookies as Record<string, string>)['cart_session'] ?? null;
    return this.customizationService.getLastCustomization(
      userId,
      sessionId,
      productId,
    );
  }

  @Get('draft/:draftId')
  @ApiOperation({ summary: 'Get a customization draft by ID' })
  async getDraftById(
    @Param('draftId') draftId: string,
  ): Promise<CustomizationDraft> {
    return this.customizationService.getDraftById(draftId);
  }
}
