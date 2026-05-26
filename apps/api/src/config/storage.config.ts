import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint:        process.env.AWS_S3_ENDPOINT,
  bucket:          process.env.AWS_S3_BUCKET  ?? 'mlh-assets',
  region:          process.env.AWS_S3_REGION  ?? 'auto',
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  cdnUrl:          process.env.CDN_URL,
  uploadTempPrefix:      process.env.UPLOAD_TEMP_PREFIX      ?? 'uploads/temp/',
  uploadPermanentPrefix: process.env.UPLOAD_PERMANENT_PREFIX ?? 'uploads/',
  previewPrefix:         process.env.PREVIEW_PREFIX          ?? 'previews/',
}));
