import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['variants'] as const)) {}
