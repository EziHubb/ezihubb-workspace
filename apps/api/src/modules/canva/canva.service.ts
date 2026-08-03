import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

@Injectable()
export class CanvaService {
  private readonly logger = new Logger(CanvaService.name);
  private readonly clientKey:    string;
  private readonly clientSecret: string;
  private readonly baseUrl:      string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
    private readonly config: ConfigService,
  ) {
    this.clientKey    = this.config.get<string>('CANVA_CLIENT_KEY')    ?? '';
    this.clientSecret = this.config.get<string>('CANVA_CLIENT_SECRET') ?? '';
    this.baseUrl      = this.config.get<string>('NEXT_PUBLIC_URL')     ?? 'https://ezihubb.com';
  }

  // ── OAuth: get authorization URL ─────────────────────────────────────────

  getAuthorizationUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     this.clientKey,
      redirect_uri:  `${this.baseUrl}/api/v1/canva/callback`,
      scope:         'design:content:read design:content:write',
      state,
    });
    return `https://www.canva.com/api/oauth/authorize?${params}`;
  }

  // ── OAuth: handle callback ─────────────────────────────────────────────

  async handleCallback(code: string, state: string): Promise<void> {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString());

    // Exchange code for token
    const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  `${this.baseUrl}/api/v1/canva/callback`,
        client_id:     this.clientKey,
        client_secret: this.clientSecret,
      }),
    });

    if (!tokenRes.ok) throw new UnauthorizedException('Canva auth failed');

    const { access_token, refresh_token, expires_in, user } = await tokenRes.json();

    await this.prisma.canvaIntegration.upsert({
      where:  { userId },
      create: {
        userId,
        canvaUserId:  user.id ?? userId,
        accessToken:  access_token,
        refreshToken: refresh_token ?? null,
        expiresAt:    new Date(Date.now() + (expires_in ?? 3600) * 1000),
      },
      update: {
        accessToken:  access_token,
        refreshToken: refresh_token ?? null,
        expiresAt:    new Date(Date.now() + (expires_in ?? 3600) * 1000),
      },
    });
  }

  // ── Get seller's products for Canva sidebar ───────────────────────────────

  async getSellerProducts(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { storeId: true },
    });
    if (!user?.storeId) return [];

    return this.prisma.product.findMany({
      where:   { storeId: user.storeId, status: 'ACTIVE' },
      select:  { id: true, name: true, slug: true, images: { where: { isPrimary: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
  }

  // ── Publish design from Canva ─────────────────────────────────────────────

  async publishDesign(userId: string, productId: string, imageBuffer: Buffer, mimeType: string): Promise<{ productImageUrl: string; productSlug: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { storeId: true },
    });
    if (!user?.storeId) throw new UnauthorizedException('Not a seller');

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: user.storeId },
      select: { id: true, slug: true },
    });
    if (!product) throw new BadRequestException('Product not found');

    // Upload to R2/S3 via storage service — for now store URL reference
    // In production: call storageService.uploadFile(...)
    const imageKey = `canva/${user.storeId}/${productId}/${Date.now()}.png`;
    const imageUrl = `${this.config.get('CDN_URL') ?? ''}/${imageKey}`;

    // Update as primary image
    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId },
        data:  { isPrimary: false },
      }),
      this.prisma.productImage.create({
        data: { productId, url: imageUrl, isPrimary: true, sortOrder: 0 },
      }),
    ]);

    return { productImageUrl: imageUrl, productSlug: product.slug };
  }

  async getIntegrationStatus(userId: string) {
    const integration = await this.prisma.canvaIntegration.findUnique({
      where:  { userId },
      select: { canvaUserId: true, expiresAt: true, createdAt: true },
    });
    return { connected: !!integration, ...integration };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.canvaIntegration.deleteMany({ where: { userId } });
  }
}
