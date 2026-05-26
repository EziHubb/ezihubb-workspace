import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host:     process.env.SMTP_HOST     ?? 'smtp.sendgrid.net',
  port:     parseInt(process.env.SMTP_PORT ?? '587', 10),
  user:     process.env.SMTP_USER,
  pass:     process.env.SMTP_PASS,
  from:     process.env.EMAIL_FROM    ?? 'noreply@mapleloomhandmade.com',
  fromName: process.env.EMAIL_FROM_NAME ?? 'MapleLoomHandmade',
  secure:   process.env.SMTP_SECURE === 'true',
}));
