import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AddressResponseDto } from './dto/address-response.dto';
import { WishlistItemResponseDto } from './dto/wishlist-item-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { memoryStorage } from 'multer';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Profile ───────────────────────────────────────────────────────────────

  // GET /users/me
  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.usersService.getProfile(user.sub);
  }

  // PATCH /users/me
  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user.sub, dto);
  }

  // POST /users/me/avatar
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { avatar: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload profile avatar (JPEG/PNG/WebP, max 5 MB)' })
  @ApiResponse({ status: 200, schema: { properties: { avatarUrl: { type: 'string' } } } })
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    return this.usersService.uploadAvatar(user.sub, file);
  }

  // DELETE /users/me/avatar
  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove profile avatar' })
  async deleteAvatar(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.usersService.deleteAvatar(user.sub);
  }

  // ─── Addresses ─────────────────────────────────────────────────────────────

  // GET /users/me/addresses
  @Get('me/addresses')
  @ApiOperation({ summary: 'List all addresses' })
  @ApiResponse({ status: 200, type: [AddressResponseDto] })
  async getAddresses(@CurrentUser() user: JwtPayload): Promise<AddressResponseDto[]> {
    return this.usersService.getAddresses(user.sub);
  }

  // POST /users/me/addresses
  @Post('me/addresses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new address (max 10)' })
  @ApiResponse({ status: 201, type: AddressResponseDto })
  async createAddress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.usersService.createAddress(user.sub, dto);
  }

  // PATCH /users/me/addresses/:id
  @Patch('me/addresses/:id')
  @ApiOperation({ summary: 'Update an address' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  async updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.usersService.updateAddress(user.sub, id, dto);
  }

  // DELETE /users/me/addresses/:id
  @Delete('me/addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an address' })
  async deleteAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<void> {
    return this.usersService.deleteAddress(user.sub, id);
  }

  // PATCH /users/me/addresses/:id/default
  @Patch('me/addresses/:id/default')
  @ApiOperation({ summary: 'Set address as default' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  async setDefaultAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
  ): Promise<AddressResponseDto> {
    return this.usersService.setDefaultAddress(user.sub, id);
  }

  // ─── Customization History ─────────────────────────────────────────────────

  // GET /users/me/customization-history
  @Get('me/customization-history')
  @ApiOperation({ summary: 'Get past customization drafts for the current user' })
  async getCustomizationHistory(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const drafts = await this.prisma.customizationDraft.findMany({
      where: { userId: user.sub },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        productId: true,
        templateId: true,
        fieldValues: true,
        previewImageUrl: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return { data: drafts, page, limit };
  }

  // ─── Wishlist ──────────────────────────────────────────────────────────────

  // GET /users/me/wishlist
  @Get('me/wishlist')
  @ApiOperation({ summary: 'Get wishlist (paginated)' })
  async getWishlist(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<WishlistItemResponseDto>> {
    return this.usersService.getWishlist(user.sub, pagination);
  }

  // POST /users/me/wishlist/:productId
  @Post('me/wishlist/:productId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add product to wishlist' })
  async addToWishlist(
    @CurrentUser() user: JwtPayload,
    @Param('productId', ParseCuidPipe) productId: string,
  ): Promise<{ id: string }> {
    return this.usersService.addToWishlist(user.sub, productId);
  }

  // DELETE /users/me/wishlist/:productId
  @Delete('me/wishlist/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove product from wishlist' })
  async removeFromWishlist(
    @CurrentUser() user: JwtPayload,
    @Param('productId', ParseCuidPipe) productId: string,
  ): Promise<void> {
    return this.usersService.removeFromWishlist(user.sub, productId);
  }

  // GET /users/me/wishlist/:productId
  @Get('me/wishlist/:productId')
  @ApiOperation({ summary: 'Check if product is in wishlist' })
  async isInWishlist(
    @CurrentUser() user: JwtPayload,
    @Param('productId', ParseCuidPipe) productId: string,
  ): Promise<{ inWishlist: boolean }> {
    return this.usersService.isInWishlist(user.sub, productId);
  }
}
