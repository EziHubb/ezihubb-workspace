import { PrismaClient } from '@prisma/client';

/**
 * Vietnamese and Chinese names for the seeded catalog.
 *
 * The translation pipeline was already built end to end — the client sends
 * `X-Locale` on every request, `extractLocale` resolves it, and either
 * `I18nInterceptor` or the service overlays `Translation` rows onto the English
 * base. What was missing was rows: the table was empty, so every locale fell
 * back to English and the language switcher looked broken from the outside.
 *
 * English is not stored here. It lives on the Category/Collection row itself
 * and is the fallback, which is why `Translation.locale` is documented as
 * "never en" — writing an `en` row would create a second source of truth for
 * the same string.
 *
 * `isAutoTranslated: false` marks these as human-written. AutoTranslateService
 * skips fields that already have a translation, so a later auto-translate run
 * will not overwrite them.
 *
 * Slugs, not ids, are the key: ids are generated at seed time and differ
 * between databases, while a slug is stable and reviewable. A slug listed here
 * that no longer exists is skipped; a category that exists with no entry here
 * is reported, so drift shows up in the log instead of silently shipping an
 * English name to a Vietnamese buyer.
 */

/** [Vietnamese, Chinese] */
type Pair = [string, string];

const CATEGORY_NAMES: Record<string, Pair> = {
  // ── L1 nav tabs ────────────────────────────────────────────────────────────
  'gifts':                    ['Quà tặng',                    '礼物'],
  'home-living':              ['Nhà cửa & Đời sống',          '家居生活'],
  'drink-barware':            ['Đồ uống & Quầy bar',          '饮品与吧台'],
  'apparel':                  ['Thời trang',                  '服饰'],
  'accessories':              ['Phụ kiện',                    '配饰'],
  'interests':                ['Sở thích',                    '兴趣'],

  // ── L2 — Gifts ─────────────────────────────────────────────────────────────
  'for-her':                  ['Cho nàng',                    '送她'],
  'for-him':                  ['Cho chàng',                   '送他'],
  'for-kids':                 ['Cho bé',                      '送孩子'],
  'for-pets':                 ['Cho thú cưng',                '送宠物'],

  // ── L2 — Home & Living ─────────────────────────────────────────────────────
  'bed-bath':                 ['Phòng ngủ & Phòng tắm',       '卧室与浴室'],
  'christmas-ornaments':      ['Đồ trang trí Giáng sinh',     '圣诞装饰'],
  'floor-rugs':               ['Sàn & Thảm',                  '地板与地毯'],
  'frames-displays':          ['Khung ảnh & Trưng bày',       '相框与展示'],
  'hanging-decoration':       ['Đồ treo trang trí',           '悬挂装饰'],
  'jewelry-storage':          ['Hộp đựng trang sức',          '首饰收纳'],
  'kitchen-dining':           ['Bếp & Phòng ăn',              '厨房与餐厅'],
  'lighting':                 ['Đèn chiếu sáng',              '照明'],
  'outdoor-gardening':        ['Ngoài trời & Làm vườn',       '户外与园艺'],
  'wall-decor':               ['Trang trí tường',             '墙面装饰'],

  // ── L2 — Drink & Barware ───────────────────────────────────────────────────
  'mugs':                     ['Cốc sứ',                      '马克杯'],
  'tumblers':                 ['Ly giữ nhiệt',                '保温杯'],
  'glasses':                  ['Ly thủy tinh',                '玻璃杯'],
  'coasters-bar':             ['Lót ly & Phụ kiện bar',       '杯垫与吧台用品'],

  // ── L2 — Apparel ───────────────────────────────────────────────────────────
  't-shirts-tops':            ['Áo thun & Áo',                'T恤与上衣'],
  'outerwear':                ['Áo khoác',                    '外套'],
  'kids-baby':                ['Trẻ em & Em bé',              '童装与婴儿'],

  // ── L2 — Accessories ───────────────────────────────────────────────────────
  'bags-totes':               ['Túi & Túi tote',              '包袋与手提袋'],
  'jewelry':                  ['Trang sức',                   '首饰'],

  // ── L3 — Gifts ─────────────────────────────────────────────────────────────
  'jewelry-and-accessories':  ['Trang sức & Phụ kiện',        '首饰与配饰'],
  'home-decor':               ['Trang trí nhà cửa',           '家居装饰'],
  'beauty-and-wellness':      ['Làm đẹp & Chăm sóc sức khỏe', '美妆与健康'],
  'drinkware':                ['Ly cốc',                      '饮具'],
  'tech-accessories':         ['Phụ kiện công nghệ',          '数码配件'],
  'outdoor':                  ['Ngoài trời',                  '户外'],
  'toys-and-games':           ['Đồ chơi & Trò chơi',          '玩具与游戏'],
  'clothing':                 ['Quần áo',                     '服装'],
  'room-decor':               ['Trang trí phòng',             '房间装饰'],
  'pet-portraits':            ['Tranh chân dung thú cưng',    '宠物肖像'],
  'pet-tags':                 ['Thẻ tên thú cưng',            '宠物名牌'],
  'pet-clothing':             ['Quần áo thú cưng',            '宠物服装'],

  // ── L3 — Bed & Bath ────────────────────────────────────────────────────────
  'blankets':                 ['Chăn',                        '毛毯'],
  'laundry-storage-basket':   ['Giỏ đựng đồ giặt',            '洗衣收纳篮'],
  'pillows':                  ['Gối',                         '枕头'],
  'quilt-sets':               ['Bộ chăn ga',                  '被套套装'],
  'wearable-blanket-hoodies': ['Chăn mặc có mũ',              '穿戴式连帽毯'],
  'throw-pillows':            ['Gối tựa trang trí',           '抱枕'],

  // ── L3 — Christmas Ornaments ───────────────────────────────────────────────
  'acrylic-ornaments':        ['Đồ trang trí acrylic',        '亚克力装饰'],
  'aluminum-ornaments':       ['Đồ trang trí nhôm',           '铝制装饰'],
  'ceramic-ornaments':        ['Đồ trang trí gốm sứ',         '陶瓷装饰'],
  'glass-ornaments':          ['Đồ trang trí thủy tinh',      '玻璃装饰'],
  'suncatcher-ornaments':     ['Đồ trang trí bắt nắng',       '捕光装饰'],
  'wooden-ornaments':         ['Đồ trang trí gỗ',             '木质装饰'],
  'ornaments':                ['Đồ trang trí in ảnh',         '照片装饰挂件'],
  'christmas-tree-skirts':    ['Thảm chân cây thông',         '圣诞树裙'],

  // ── L3 — Floor & Rugs ──────────────────────────────────────────────────────
  'doormats':                 ['Thảm chùi chân',              '门垫'],
  'runner-rugs':              ['Thảm dài hành lang',          '长条地毯'],

  // ── L3 — Frames and Displays ───────────────────────────────────────────────
  'acrylic-plaques':          ['Bảng acrylic',                '亚克力牌匾'],
  'acrylic-desk-clocks':      ['Đồng hồ để bàn acrylic',      '亚克力桌面时钟'],
  'ceramic-flower-vases':     ['Bình hoa gốm sứ',             '陶瓷花瓶'],
  'ceramic-plates':           ['Đĩa gốm sứ',                  '陶瓷盘'],
  'family-puzzles':           ['Ghép hình gia đình',          '家庭拼图'],
  'magnets':                  ['Nam châm dán tủ lạnh',        '冰箱贴'],

  // ── L3 — Hanging Decoration ────────────────────────────────────────────────
  'suncatchers':              ['Đồ bắt nắng',                 '捕光挂饰'],
  'wine-bottle-wind-chimes':  ['Chuông gió từ vỏ chai rượu',  '酒瓶风铃'],
  'wood-signs':               ['Bảng gỗ',                     '木牌'],

  // ── L3 — Jewelry Storage ───────────────────────────────────────────────────
  'jewelry-dishes':           ['Đĩa đựng trang sức',          '首饰碟'],
  'jewelry-boxes':            ['Hộp trang sức',               '首饰盒'],
  'leather-valet-trays':      ['Khay da đựng đồ',             '皮革收纳托盘'],
  'makeup-boxes-with-led-mirror': ['Hộp trang điểm gương LED', '带 LED 镜化妆盒'],

  // ── L3 — Kitchen & Dining ──────────────────────────────────────────────────
  'cookie-jars':              ['Hũ đựng bánh',                '饼干罐'],
  'cutting-boards':           ['Thớt',                        '砧板'],
  'oven-mitts-and-pot-holders': ['Găng tay lò & Lót nồi',     '隔热手套与锅垫'],
  'platters':                 ['Khay bày món',                '餐盘'],
  'tea-and-biscuit-boards':   ['Khay trà & Bánh quy',         '茶点托盘'],

  // ── L3 — Lighting ──────────────────────────────────────────────────────────
  'bottle-lamps':             ['Đèn từ vỏ chai',              '瓶灯'],
  'fabric-lamps':             ['Đèn vải',                     '布艺灯'],
  'led-candles':              ['Nến LED',                     'LED 蜡烛'],
  'led-night-light':          ['Đèn ngủ LED',                 'LED 小夜灯'],
  'mason-jar-lights':         ['Đèn lọ thủy tinh',            '梅森罐灯'],
  'vintage-lantern-night-lights': ['Đèn ngủ kiểu đèn lồng cổ', '复古灯笼夜灯'],

  // ── L3 — Outdoor & Gardening ───────────────────────────────────────────────
  'ceramic-plant-pots':       ['Chậu cây gốm sứ',             '陶瓷花盆'],
  'door-corner-wood-signs':   ['Bảng gỗ góc cửa',             '门角木牌'],
  'garden-stakes':            ['Cọc trang trí sân vườn',      '花园插牌'],
  'indoor-watering-cans':     ['Bình tưới cây trong nhà',     '室内浇水壶'],
  'metal-signs':              ['Bảng kim loại',               '金属牌'],
  'solar-lights':             ['Đèn năng lượng mặt trời',     '太阳能灯'],
  'wind-chimes':              ['Chuông gió',                  '风铃'],

  // ── L3 — Wall Decor ────────────────────────────────────────────────────────
  'canvas':                   ['Tranh poster & Canvas',       '海报与画布'],
  'key-holders':              ['Móc treo chìa khóa',          '钥匙挂架'],
  'wood-acrylic-art':         ['Tranh tường gỗ & Acrylic',    '木质与亚克力墙饰'],

  // ── L3 — Mugs ──────────────────────────────────────────────────────────────
  'coffee-mugs':              ['Cốc cà phê',                  '咖啡杯'],
  'photo-mugs':               ['Cốc in ảnh',                  '照片马克杯'],
  'travel-mugs':              ['Cốc giữ nhiệt du lịch',       '旅行保温杯'],
  'enamel-mugs':              ['Cốc tráng men',               '搪瓷杯'],

  // ── L3 — Tumblers ──────────────────────────────────────────────────────────
  'stainless-steel-tumblers': ['Ly giữ nhiệt inox',           '不锈钢保温杯'],
  'glass-tumblers':           ['Ly thủy tinh cao',            '玻璃随行杯'],
  'sports-bottles':           ['Bình nước thể thao',          '运动水壶'],

  // ── L3 — Glasses ───────────────────────────────────────────────────────────
  'wine-glasses':             ['Ly rượu vang',                '红酒杯'],
  'beer-glasses':             ['Ly bia',                      '啤酒杯'],
  'champagne-flutes':         ['Ly champagne',                '香槟杯'],
  'shot-glasses':             ['Ly shot',                     '烈酒杯'],

  // ── L3 — Coasters & Bar ────────────────────────────────────────────────────
  'coaster-sets':             ['Bộ lót ly',                   '杯垫套装'],
  'bottle-openers':           ['Đồ khui chai',                '开瓶器'],
  'wine-racks':               ['Kệ đựng rượu',                '红酒架'],
  'beer-steins':              ['Cốc bia có nắp',              '带盖啤酒杯'],

  // ── L3 — T-Shirts & Tops ───────────────────────────────────────────────────
  'classic-tees':             ['Áo thun cổ tròn',             '经典圆领 T 恤'],
  'v-neck-tees':              ['Áo thun cổ tim',              'V 领 T 恤'],
  'long-sleeve-shirts':       ['Áo dài tay',                  '长袖上衣'],
  'tank-tops':                ['Áo ba lỗ',                    '背心'],

  // ── L3 — Outerwear ─────────────────────────────────────────────────────────
  'hoodies':                  ['Áo hoodie',                   '连帽衫'],
  'zip-hoodies':              ['Áo hoodie khóa kéo',          '拉链连帽衫'],
  'sweatshirts':              ['Áo nỉ',                       '卫衣'],
  'bomber-jackets':           ['Áo khoác bomber',             '飞行员夹克'],

  // ── L3 — Kids & Baby ───────────────────────────────────────────────────────
  'onesies':                  ['Áo liền quần cho bé',         '婴儿连体衣'],
  'kids-t-shirts':            ['Áo thun trẻ em',              '童装 T 恤'],
  'baby-bibs':                ['Yếm ăn cho bé',               '婴儿围兜'],
  'baby-blankets':            ['Chăn cho bé',                 '婴儿毯'],

  // ── L3 — Bags & Totes ──────────────────────────────────────────────────────
  'tote-bags':                ['Túi tote',                    '手提袋'],
  'backpacks':                ['Ba lô',                       '双肩包'],
  'drawstring-bags':          ['Túi dây rút',                 '束口袋'],
  'fanny-packs':              ['Túi đeo bụng',                '腰包'],

  // ── L3 — Jewelry ───────────────────────────────────────────────────────────
  'necklaces':                ['Dây chuyền',                  '项链'],
  'bracelets':                ['Vòng tay',                    '手链'],
  'keychains':                ['Móc khóa',                    '钥匙扣'],
  'rings':                    ['Nhẫn',                        '戒指'],
};

const COLLECTION_NAMES: Record<string, Pair> = {
  'valentines-day': ['Lễ Tình nhân', '情人节'],
  'birthday':       ['Sinh nhật',    '生日'],
  'anniversary':    ['Kỷ niệm',      '纪念日'],
  'mothers-day':    ['Ngày của Mẹ',  '母亲节'],
  'fathers-day':    ['Ngày của Cha', '父亲节'],
  'graduation':     ['Tốt nghiệp',   '毕业'],
  'christmas':      ['Giáng sinh',   '圣诞节'],
  'wedding':        ['Đám cưới',     '婚礼'],
  'new-baby':       ['Chào bé yêu',  '新生儿'],
  'retirement':     ['Nghỉ hưu',     '退休'],
};

const LOCALES = ['vi', 'zh'] as const;

async function seedNames(
  prisma:     PrismaClient,
  entityType: 'Category' | 'Collection',
  rows:       { id: string; slug: string }[],
  names:      Record<string, Pair>,
): Promise<number> {
  let written = 0;

  for (const row of rows) {
    const pair = names[row.slug];
    if (!pair) {
      console.warn(`    ⚠  No translation for ${entityType} "${row.slug}" — will show in English`);
      continue;
    }

    for (let i = 0; i < LOCALES.length; i++) {
      const locale = LOCALES[i];
      const value  = pair[i];

      await prisma.translation.upsert({
        where: {
          entityType_entityId_locale_field: {
            entityType, entityId: row.id, locale, field: 'name',
          },
        },
        // Overwrite on re-run: this file is the source of these strings, so a
        // corrected name here should reach a database that already has the old
        // one. Only `name`, and only vi/zh — nothing else in the row is touched.
        update: { value, isAutoTranslated: false },
        create: { entityType, entityId: row.id, locale, field: 'name', value, isAutoTranslated: false },
      });
      written++;
    }
  }

  const unused = Object.keys(names).filter((s) => !rows.some((r) => r.slug === s));
  if (unused.length) {
    console.warn(`    ⚠  ${unused.length} ${entityType} slug(s) in this file no longer exist: ${unused.join(', ')}`);
  }

  return written;
}

export async function seedTranslations(prisma: PrismaClient) {
  console.log('  🌐 Seeding vi/zh names...');

  const categories  = await prisma.category.findMany({ select: { id: true, slug: true } });
  const collections = await prisma.collection.findMany({ select: { id: true, slug: true } });

  const catRows = await seedNames(prisma, 'Category',   categories,  CATEGORY_NAMES);
  const colRows = await seedNames(prisma, 'Collection', collections, COLLECTION_NAMES);

  console.log(`    ✓ ${catRows} category + ${colRows} collection translation rows`);
}
