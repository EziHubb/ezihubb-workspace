import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CollectionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() description: string | null;
  @ApiPropertyOptional() bannerUrl: string | null;
  @ApiPropertyOptional() occasion: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() sortOrder: number;
  @ApiPropertyOptional() startDate: Date | null;
  @ApiPropertyOptional() endDate: Date | null;
  @ApiProperty() productCount: number;
  @ApiProperty() createdAt: Date;
}

export class TagResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() productCount: number;
}
