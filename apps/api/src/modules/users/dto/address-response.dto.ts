import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Address } from '@prisma/client';

export class AddressResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() label: string | null;
  @ApiProperty() fullName: string;
  @ApiProperty() line1: string;
  @ApiPropertyOptional() line2: string | null;
  @ApiProperty() city: string;
  @ApiPropertyOptional() state: string | null;
  @ApiProperty() postalCode: string;
  @ApiProperty() country: string;
  @ApiPropertyOptional() phone: string | null;
  @ApiProperty() isDefault: boolean;
  @ApiProperty() createdAt: Date;

  static fromPrisma(address: Address): AddressResponseDto {
    const dto = new AddressResponseDto();
    dto.id = address.id;
    dto.label = null;
    dto.fullName = address.fullName;
    dto.line1 = address.addressLine1;
    dto.line2 = address.addressLine2 ?? null;
    dto.city = address.city;
    dto.state = address.state;
    dto.postalCode = address.postalCode;
    dto.country = address.country;
    dto.phone = address.phone;
    dto.isDefault = address.isDefault;
    dto.createdAt = address.createdAt;
    return dto;
  }
}
