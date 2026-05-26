import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Injectable()
export class FileSizePipe implements PipeTransform<MulterFile, MulterFile> {
  constructor(
    private readonly maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    private readonly allowedTypes = ALLOWED_IMAGE_TYPES,
  ) {}

  transform(file: MulterFile): MulterFile {
    if (!file) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'No file provided.',
      });
    }

    if (file.size > this.maxSizeBytes) {
      const maxMb = (this.maxSizeBytes / 1024 / 1024).toFixed(0);
      throw new BadRequestException({
        code: 'ERR_FILE_TOO_LARGE',
        message: `File size exceeds the ${maxMb}MB limit.`,
      });
    }

    if (this.allowedTypes.size > 0 && !this.allowedTypes.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'ERR_FILE_TYPE_INVALID',
        message: `File type "${file.mimetype}" is not supported. Allowed: ${[...this.allowedTypes].join(', ')}.`,
      });
    }

    return file;
  }
}
