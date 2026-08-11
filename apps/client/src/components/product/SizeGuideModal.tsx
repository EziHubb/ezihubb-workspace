'use client';

import { useTranslations } from 'next-intl';
import { Modal, ModalHeader, ModalBody } from '@ezihubb/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductType = 'apparel' | 'canvas' | 'drinkware' | 'other';

export interface SizeGuideModalProps {
  isOpen:           boolean;
  onClose:          () => void;
  productType:      ProductType;
  customSizeGuide?: string;
}

// ── Default size guides ───────────────────────────────────────────────────────

type Translator = ReturnType<typeof useTranslations>;

function buildApparelSizeGuide(t: Translator): string {
  return `
<table>
  <thead>
    <tr><th>${t('sizeGuide.apparel.size')}</th><th>${t('sizeGuide.apparel.chest')}</th><th>${t('sizeGuide.apparel.waist')}</th><th>${t('sizeGuide.apparel.length')}</th></tr>
  </thead>
  <tbody>
    <tr><td>S</td><td>34–36</td><td>28–30</td><td>27</td></tr>
    <tr><td>M</td><td>38–40</td><td>32–34</td><td>28</td></tr>
    <tr><td>L</td><td>42–44</td><td>36–38</td><td>29</td></tr>
    <tr><td>XL</td><td>46–48</td><td>40–42</td><td>30</td></tr>
    <tr><td>2XL</td><td>50–52</td><td>44–46</td><td>31</td></tr>
  </tbody>
</table>
<p>${t('sizeGuide.apparel.note')}</p>
`;
}

function buildCanvasSizeGuide(t: Translator): string {
  return `
<table>
  <thead>
    <tr><th>${t('sizeGuide.canvas.sizeCode')}</th><th>${t('sizeGuide.canvas.inches')}</th><th>${t('sizeGuide.canvas.centimeters')}</th><th>${t('sizeGuide.canvas.bestFor')}</th></tr>
  </thead>
  <tbody>
    <tr><td>8x10</td><td>8×10"</td><td>20×25 cm</td><td>${t('sizeGuide.canvas.desktopDisplay')}</td></tr>
    <tr><td>12x16</td><td>12×16"</td><td>30×40 cm</td><td>${t('sizeGuide.canvas.smallWall')}</td></tr>
    <tr><td>16x20</td><td>16×20"</td><td>40×50 cm</td><td>${t('sizeGuide.canvas.featureWall')}</td></tr>
    <tr><td>20x24</td><td>20×24"</td><td>51×61 cm</td><td>${t('sizeGuide.canvas.largePiece')}</td></tr>
    <tr><td>11x14</td><td>11×14"</td><td>28×36 cm</td><td>${t('sizeGuide.canvas.portrait')}</td></tr>
  </tbody>
</table>
<p>${t('sizeGuide.canvas.note')}</p>
`;
}

function buildDrinkwareSizeGuide(t: Translator): string {
  return `
<table>
  <thead>
    <tr><th>${t('sizeGuide.drinkware.size')}</th><th>${t('sizeGuide.drinkware.height')}</th><th>${t('sizeGuide.drinkware.diameter')}</th><th>${t('sizeGuide.drinkware.bestFor')}</th></tr>
  </thead>
  <tbody>
    <tr><td>11oz</td><td>3.8"</td><td>3.2"</td><td>${t('sizeGuide.drinkware.standardCoffee')}</td></tr>
    <tr><td>15oz</td><td>4.5"</td><td>3.4"</td><td>${t('sizeGuide.drinkware.largerDrinks')}</td></tr>
    <tr><td>20oz</td><td>6.9"</td><td>3.5"</td><td>${t('sizeGuide.drinkware.tumbler')}</td></tr>
    <tr><td>30oz</td><td>8.0"</td><td>4.0"</td><td>${t('sizeGuide.drinkware.hydration')}</td></tr>
  </tbody>
</table>
<p>${t('sizeGuide.drinkware.note')}</p>
`;
}

function buildDefaultSizeGuides(t: Translator): Partial<Record<ProductType, string>> {
  return {
    apparel:   buildApparelSizeGuide(t),
    canvas:    buildCanvasSizeGuide(t),
    drinkware: buildDrinkwareSizeGuide(t),
  };
}

// ── Inline sanitizer ──────────────────────────────────────────────────────────
// DOMPurify would be ideal here (install with: pnpm add -w dompurify @types/dompurify).
// Since it's not currently in the dependency tree and size-guide content is
// admin-controlled (not user-generated), we strip the most dangerous vectors.

function stripDangerousHtml(html: string): string {
  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Remove javascript: and data: URIs
    .replace(/\bjavascript\s*:/gi, 'removed:')
    .replace(/\bdata\s*:/gi, 'removed:')
    // Remove <style> and <link> tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, '');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SizeGuideModal({
  isOpen,
  onClose,
  productType,
  customSizeGuide,
}: SizeGuideModalProps) {
  const t = useTranslations('product');
  const tCommon = useTranslations('common');

  const html = customSizeGuide
    ? stripDangerousHtml(customSizeGuide)
    : buildDefaultSizeGuides(t)[productType] ?? '';

  if (!html) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader onClose={onClose} closeLabel={tCommon('close')}>
        {t('sizeGuide.title')}
      </ModalHeader>

      <ModalBody>
        <div
          className="size-guide-content"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </ModalBody>
    </Modal>
  );
}
