import { IsIn, IsOptional, IsString } from 'class-validator';
import { ART_STYLE_IDS } from '../art-styles.config';

export class ApplyArtStyleDto {
  @IsString()
  imageKey!: string;

  @IsString()
  @IsIn([...ART_STYLE_IDS])
  style!: string;

  @IsString()
  @IsOptional()
  draftId?: string;
}
