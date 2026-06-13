import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryL3Dto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() imageUrl: string | null;
  @ApiProperty() sortOrder: number;
  @ApiProperty() productCount: number;
}

export class CategoryChildDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() imageUrl: string | null;
  @ApiProperty() sortOrder: number;
  @ApiProperty() productCount: number;
  @ApiProperty({ type: [CategoryL3Dto] }) children: CategoryL3Dto[];
}

export class CategoryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() description: string | null;
  @ApiPropertyOptional() imageUrl: string | null;
  @ApiProperty() sortOrder: number;
  @ApiProperty() isVisible: boolean;
  @ApiPropertyOptional() parentId: string | null;
  @ApiProperty({ type: [CategoryChildDto] }) children: CategoryChildDto[];
  @ApiProperty() productCount: number;
  @ApiProperty() createdAt: Date;
}
