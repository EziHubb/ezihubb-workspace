import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { ProcessingProfileType } from '@prisma/client';

export class CreateProcessingProfileDto {
  @ApiProperty({ example: 'Made to order' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: ProcessingProfileType, example: ProcessingProfileType.MADE_TO_ORDER })
  @IsEnum(ProcessingProfileType)
  type!: ProcessingProfileType;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  @Max(180)
  minDays!: number;

  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(0)
  @Max(180)
  maxDays!: number;
}

export class UpdateProcessingProfileDto extends PartialType(CreateProcessingProfileDto) {}

export class ProcessingScheduleDto {
  @ApiPropertyOptional({ description: 'Whether this seller processes/packages orders on Saturdays' })
  @IsOptional()
  @IsBoolean()
  processesOnSaturday?: boolean;

  @ApiPropertyOptional({ description: 'Whether this seller processes/packages orders on Sundays' })
  @IsOptional()
  @IsBoolean()
  processesOnSunday?: boolean;
}

export class DeliveryUpgradesDto {
  @ApiProperty({ description: 'Shop-level switch for paid expedited-delivery upgrades' })
  @IsBoolean()
  enabled!: boolean;
}
