import {
  Get,
  Post,
  Res,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { CsvImportService } from './csv-import.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';
import { ProductStoreWriteGuard } from './guards/product-store-write.guard';

@UseGuards(ProductStoreWriteGuard)
@AdminController('products/import')
export class CsvImportController {
  constructor(private readonly csvImport: CsvImportService, private readonly storeContext: StoreContextService) {}

  @Get('template')
  downloadTemplate(@Res() res: Response): void {
    const buffer = this.csvImport.generateTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products-import-template.csv"');
    res.end(buffer);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async validateCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.mimetype.includes('csv') && !file.originalname.endsWith('.csv')) {
      throw new BadRequestException('File must be a CSV');
    }
    return this.csvImport.validateCsv(file.buffer);
  }

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async executeCsvImport(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.mimetype.includes('csv') && !file.originalname.endsWith('.csv')) {
      throw new BadRequestException('File must be a CSV');
    }
    const scope = await this.storeContext.resolve(req);
    return this.csvImport.executeCsvImport(file.buffer, this.storeContext.requireStoreId(scope));
  }
}
