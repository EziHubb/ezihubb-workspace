import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('storage.endpoint');
    const region   = config.get<string>('storage.region') ?? 'auto';

    this.s3 = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId:     config.get<string>('storage.accessKeyId')     ?? '',
        secretAccessKey: config.get<string>('storage.secretAccessKey') ?? '',
      },
    });

    this.bucket = config.get<string>('storage.bucket') ?? 'mlh-assets';
    this.cdnUrl = config.get<string>('storage.cdnUrl');
  }

  /**
   * Upload a file buffer to R2/S3.
   * Returns the public URL (CDN if configured, otherwise S3 URL).
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
    options: { isPublic?: boolean } = { isPublic: true },
  ): Promise<string> {
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket:      this.bucket,
          Key:         key,
          Body:        buffer,
          ContentType: contentType,
          ...(options.isPublic ? { ACL: 'public-read' } : {}),
        }),
      );

      return this.getPublicUrl(key);
    } catch (err) {
      this.logger.error(`Upload failed for key "${key}": ${(err as Error).message}`);
      throw new InternalServerErrorException({
        code: 'ERR_UPLOAD_FAILED',
        message: 'File upload failed. Please try again.',
      });
    }
  }

  /** Check if a file exists by key — returns false on any error (including not found) */
  async existsFile(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  /** Delete a file by key */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.error(`Delete failed for key "${key}": ${(err as Error).message}`);
    }
  }

  /**
   * Generate a pre-signed URL for private file access.
   * @param expiresIn — seconds until expiry (default: 3600)
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Build a deterministic storage key.
   * Example: generateKey('uploads/temp', 'photo.jpg') → 'uploads/temp/uuid.jpg'
   */
  generateKey(prefix: string, filename: string): string {
    const ext  = extname(filename).toLowerCase();
    const uuid = randomUUID();
    const clean = prefix.replace(/\/+$/, '');
    return `${clean}/${uuid}${ext}`;
  }

  /** Returns CDN URL if configured, falls back to S3 path-style URL */
  getPublicUrl(key: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  /** Extract the storage key from a full URL */
  extractKey(url: string): string {
    if (this.cdnUrl && url.startsWith(this.cdnUrl)) {
      return url.slice(this.cdnUrl.length).replace(/^\//, '');
    }
    const s3Base = `https://${this.bucket}.s3.amazonaws.com/`;
    if (url.startsWith(s3Base)) {
      return url.slice(s3Base.length);
    }
    return url;
  }

  /**
   * Generate a presigned PUT URL for direct browser upload.
   * Returns the presigned URL (for the PUT) and the final public CDN URL.
   */
  async getPresignedUploadUrl(
    prefix: string,
    filename: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<{ presignedUrl: string; publicUrl: string; key: string }> {
    const key = this.generateKey(prefix, filename);
    const command = new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(this.s3, command, { expiresIn });
    return { presignedUrl, publicUrl: this.getPublicUrl(key), key };
  }
}
