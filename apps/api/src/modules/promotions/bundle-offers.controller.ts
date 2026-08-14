import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BundleOffersService } from './bundle-offers.service';
import {
  BundleOfferResponseDto,
  CreateBundleOfferDto,
  UpdateBundleOfferDto,
} from './dto/bundle-offer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { StoreContextService } from '../../common/services/store-context.service';

@ApiTags('bundle-offers')
@Controller('bundle-offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class BundleOffersController {
  constructor(
    private readonly bundleOffersService: BundleOffersService,
    private readonly storeContext: StoreContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a "buy them together" bundle offer' })
  async create(@Req() req: Request, @Body() dto: CreateBundleOfferDto): Promise<BundleOfferResponseDto> {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.bundleOffersService.create(dto, storeId);
  }

  @Get()
  @ApiOperation({ summary: 'List bundle offers for the current store' })
  async findAll(@Req() req: Request): Promise<BundleOfferResponseDto[]> {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.bundleOffersService.findAll(storeId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bundle offer' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateBundleOfferDto,
  ): Promise<BundleOfferResponseDto> {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.bundleOffersService.update(id, dto, storeId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a bundle offer' })
  async remove(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.bundleOffersService.remove(id, storeId);
  }
}
