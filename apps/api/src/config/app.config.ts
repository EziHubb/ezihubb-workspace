import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port:        parseInt(process.env.PORT ?? '3002', 10),
  env:         process.env.NODE_ENV ?? 'development',
  nodeEnv:     process.env.NODE_ENV ?? 'development',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001').split(','),
  appUrl:      process.env.APP_URL ?? 'http://localhost:3002',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
}));
