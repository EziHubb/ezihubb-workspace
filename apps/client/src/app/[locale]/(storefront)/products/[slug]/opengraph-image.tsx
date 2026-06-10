import { ImageResponse } from 'next/og';
import type { ProductDto } from '@mlh/types';

// ── Route segment config ──────────────────────────────────────────────────────

export const runtime     = 'edge';
export const alt         = 'Product';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

// ── Fetcher ───────────────────────────────────────────────────────────────────

const API = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002').replace(/\/api\/v1\/?$/, '');

async function getProduct(slug: string): Promise<ProductDto | null> {
  try {
    const res = await fetch(`${API}/api/v1/products/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body.data ?? body) as ProductDto;
  } catch {
    return null;
  }
}

// ── Brand colors ──────────────────────────────────────────────────────────────

const CORAL  = '#E85D3F';
const DARK   = '#2D2D2D';
const LIGHT  = '#FFF0EC';
const MUTED  = '#6B6B6B';

// ── OG Image ──────────────────────────────────────────────────────────────────

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);

  // ── Fallback: brand card with no product ─────────────────────────────────

  if (!product) {
    return new ImageResponse(
      (
        <div
          style={{
            display:         'flex',
            width:           '100%',
            height:          '100%',
            backgroundColor: LIGHT,
            alignItems:      'center',
            justifyContent:  'center',
            flexDirection:   'column',
            gap:             '16px',
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 700, color: CORAL }}>
            Maple Handmade
          </div>
          <div style={{ fontSize: 28, color: MUTED }}>
            Personalized Handmade Gifts
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const primaryImage = product.images?.[0]?.url;
  const price        = `$${product.basePrice.toFixed(2)}`;

  return new ImageResponse(
    (
      <div
        style={{
          display:         'flex',
          width:           '100%',
          height:          '100%',
          backgroundColor: '#FAFAF8',
        }}
      >
        {/* Left: product image (45%) */}
        <div
          style={{
            display:         'flex',
            width:           '45%',
            height:          '100%',
            overflow:        'hidden',
            backgroundColor: LIGHT,
          }}
        >
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                width:           '100%',
                height:          '100%',
                fontSize:         72,
              }}
            >
              🎁
            </div>
          )}
        </div>

        {/* Right: product info (55%) */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            justifyContent: 'space-between',
            width:          '55%',
            height:         '100%',
            padding:        '60px 56px',
          }}
        >
          {/* Brand header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width:           '8px',
                height:          '32px',
                backgroundColor: CORAL,
                borderRadius:    '4px',
              }}
            />
            <span style={{ fontSize: 22, color: MUTED, fontWeight: 600 }}>
              Maple Handmade
            </span>
          </div>

          {/* Product name */}
          <div
            style={{
              fontSize:    52,
              fontWeight:  700,
              color:       DARK,
              lineHeight:  1.2,
              flex:        1,
              display:     'flex',
              alignItems:  'center',
              marginTop:   '24px',
            }}
          >
            {product.name.length > 60
              ? `${product.name.slice(0, 57)}…`
              : product.name}
          </div>

          {/* Price + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: 18, color: MUTED }}>Starting from</span>
              <span style={{ fontSize: 44, fontWeight: 800, color: CORAL }}>
                {price}
              </span>
            </div>

            {/* Personalize badge */}
            {product.isPersonalizable && (
              <div
                style={{
                  backgroundColor: CORAL,
                  color:           '#fff',
                  borderRadius:    '8px',
                  padding:         '12px 24px',
                  fontSize:        20,
                  fontWeight:      700,
                }}
              >
                Personalize Now →
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
