import {
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CsvImportService } from './csv-import.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';

@AdminController('products/import')
export class CsvImportController {
  constructor(private readonly csvImport: CsvImportService) {}

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
  async executeCsvImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.mimetype.includes('csv') && !file.originalname.endsWith('.csv')) {
      throw new BadRequestException('File must be a CSV');
    }
    return this.csvImport.executeCsvImport(file.buffer);
  }
}
