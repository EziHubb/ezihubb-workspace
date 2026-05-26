import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';
import { IsString, IsUppercase, Length } from 'class-validator';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ShippingEstimateDto } from '../cart/dto/cart-response.dto';

class GetMethodsQuery {
  @IsString()
  @IsUppercase()
  @Length(2, 2)
  countryCode!: string;
}

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Get available shipping options for a country and order total' })
  async calculateOptions(@Body() dto: CalculateShippingDto): Promise<ShippingEstimateDto[]> {
    return this.shippingService.calculateShippingOptions(dto);
  }

  @Get('methods')
  @ApiOperation({ summary: 'Get active shipping methods available for a country' })
  @ApiQuery({ name: 'countryCode', example: 'US' })
  async getMethods(@Query('countryCode') countryCode: string): Promise<ShippingEstimateDto[]> {
    return this.shippingService.getMethodsByCountry((countryCode ?? 'US').toUpperCase());
  }
}
