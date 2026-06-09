import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Currency')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @Public()
  @ApiOperation({ summary: 'Get USD-based exchange rates (cached 24h)' })
  async getRates() {
    return this.currencyService.getRates();
  }

  @Get('supported')
  @Public()
  @ApiOperation({ summary: 'List supported display currencies' })
  getSupportedCurrencies() {
    return this.currencyService.getSupportedCurrencies();
  }
}
