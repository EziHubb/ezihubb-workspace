import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ProgressStepDto {
  /** Absent for a step being created; present to keep an existing one's id. */
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}

export class SaveProgressStepsDto {
  /**
   * The shop's custom steps, in pipeline order. The two locked ends are not
   * listed — they cannot be renamed, moved or removed, so accepting them here
   * would only invite a client to try.
   *
   * Capped because these render as tabs across the top of the Orders page; a
   * seller with 200 of them has a broken screen, not a workflow.
   */
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProgressStepDto)
  steps!: ProgressStepDto[];
}

export class MoveOrdersToStepDto {
  @IsString()
  stepId!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  storeOrderIds!: string[];
}

export class SetShipByDateDto {
  /** Null clears the promise, putting the order in the "No estimate" bucket. */
  @IsOptional()
  @IsDateString()
  shipByDate?: string | null;
}

export class SetGiftDto {
  @IsBoolean()
  isGift!: boolean;
}
