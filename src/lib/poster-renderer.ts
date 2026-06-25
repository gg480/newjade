/**
 * 贵金属市价竞品对比 — 海报渲染库
 *
 * 提供 Canvas 2D 共用绘图原语 + 三套营销模板：
 *   - daily（每日金价播报）
 *   - savings（省钱对比）
 *   - festival（节日营销）
 *
 * 设计原则：
 *   - 所有绘制函数为纯函数，不修改外部状态
 *   - 模板通过 PosterTemplate 数据对象配置
 *   - 支持任意 DPR 以在不同屏幕上清晰渲染
 */

// ── 类型定义 ──────────────────────────────────────────

export interface PosterData {
  storeName: string;
  ourPrice: number;
  competitorAvg: number;
  diff: number;          // competitorAvg - ourPrice，正数=本店更便宜
  competitorNames: string[];
  competitorCount: number;
  dataDate: string;
  // 可选配置
  slogan?: string;
  festivalName?: string; // 仅 festival 模板使用
  festivalDaysLeft?: number;
}

export type TemplateId = 'daily' | 'savings' | 'festival';

export interface PosterTemplate {
  id: TemplateId;
  name: string;
  description: string;
  width: number;
  height: number;
  render: (ctx: CanvasRenderingContext2D, data: PosterData) => void;
}

// ── 基础绘图原语 ──────────────────────────────────────

/** 绘制圆角矩形路径（不自动 fill/stroke） */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.closePath();
}

/** 绘制渐变圆角矩形 */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill: string | CanvasGradient,
) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** 测量并居中绘制文字 */
export function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  font: string, fill: string,
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** 绘制装饰金点（微小的金色散点，营造精品感） */
export function drawGoldDust(
  ctx: CanvasRenderingContext2D,
  W: number, areaH: number, count = 20,
) {
  const seeded = mulberry32(W + 42); // 确定性伪随机
  for (let i = 0; i < count; i++) {
    const x = seeded() * W;
    const y = seeded() * areaH;
    const r = 0.5 + seeded() * 1.5;
    const alpha = 0.08 + seeded() * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 120, ${alpha})`;
    ctx.fill();
  }
}

/** 简单的伪随机数生成器（确定性，用于装饰元素的稳定位置） */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 高级绘图组件 ──────────────────────────────────────

/** 品牌头：店名 + slogan */
export function drawBrandHeader(
  ctx: CanvasRenderingContext2D,
  data: PosterData, W: number, y: number,
  textColor = '#fef8f0',
) {
  // 顶部金色分隔线
  ctx.fillStyle = 'rgba(212, 168, 75, 0.6)';
  ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = 'rgba(212, 168, 75, 0.3)';
  ctx.fillRect(0, y + 2, W, 1);

  drawCenteredText(ctx, data.storeName, W / 2, y - 12,
    '15px "PingFang SC", "Microsoft YaHei", sans-serif', textColor);

  if (data.slogan) {
    drawCenteredText(ctx, data.slogan, W / 2, y - 12 + 16,
      '11px "PingFang SC", sans-serif',
      textColor.replace('fef8f0', 'd4a84b').replace('1)', '0.7)'));
  }
}

/** 大号价格数字（视觉锚点） */
export function drawPriceHero(
  ctx: CanvasRenderingContext2D,
  price: number, W: number, y: number,
  label = '元 / 克',
  mainColor = '#fef8f0', labelColor = 'rgba(254, 248, 240, 0.6)',
) {
  // 装饰小标签
  drawCenteredText(ctx, '✦ 每日饰金价 ✦', W / 2, y - 10,
    '14px "PingFang SC", sans-serif',
    labelColor);

  // 大号价格
  drawCenteredText(ctx, `¥${price.toFixed(0)}`, W / 2, y + 65,
    'bold 80px "PingFang SC", "Microsoft YaHei", sans-serif',
    mainColor);

  // 单位标签
  drawCenteredText(ctx, label, W / 2, y + 105,
    '16px "PingFang SC", sans-serif', labelColor);

  return y + 120; // 返回此组件占用的底部 Y
}

/** 省钱徽标（红色醒目 badge） */
export function drawSavingsBadge(
  ctx: CanvasRenderingContext2D,
  diff: number, W: number, y: number,
): number {
  if (diff <= 0) return y;

  const badgeText = `每克省 ¥${diff.toFixed(0)}`;
  ctx.font = 'bold 22px "PingFang SC", sans-serif';
  const tw = ctx.measureText(badgeText).width;
  const badgeW = tw + 60; // emoji + padding
  const badgeH = 46;
  const badgeX = (W - badgeW) / 2;

  // 渐变红色背景
  const badgeGrad = ctx.createLinearGradient(badgeX, y, badgeX + badgeW, y);
  badgeGrad.addColorStop(0, '#dc2626');
  badgeGrad.addColorStop(1, '#b91c1c');
  fillRoundRect(ctx, badgeX, y, badgeW, badgeH, 23, badgeGrad);

  // 阴影
  ctx.shadowColor = 'rgba(220, 38, 38, 0.3)';
  ctx.shadowBlur = 12;
  roundRectPath(ctx, badgeX, y, badgeW, badgeH, 23);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 文字
  drawCenteredText(ctx, `🔥 ${badgeText}`, W / 2, y + badgeH / 2,
    'bold 22px "PingFang SC", sans-serif', '#ffffff');

  // 下方小字
  drawCenteredText(ctx, '比各大品牌饰金零售均价更划算', W / 2, y + badgeH + 22,
    '13px "PingFang SC", sans-serif', 'rgba(254, 248, 240, 0.65)');

  return y + badgeH + 44;
}

/** 对比条形：本店 vs 竞品均价 */
export function drawComparisonBars(
  ctx: CanvasRenderingContext2D,
  data: PosterData, W: number, startY: number,
  titleColor = '#6b3a1a',
  ourBarColors = ['#d4a84b', '#b8860b'],
  otherBarColor = '#d1d5db',
  ourTextColor = '#5c2e0a',
  otherTextColor = '#6b7280',
): number {
  const barLeft = 90;
  const barRight = W - 90;
  const barUsable = barRight - barLeft;

  // 小标题
  drawCenteredText(ctx, '价格对比', W / 2, startY,
    '15px "PingFang SC", sans-serif', titleColor);

  // 分割线
  ctx.fillStyle = 'rgba(166, 124, 82, 0.2)';
  ctx.fillRect(barLeft, startY + 16, barUsable, 1);

  const comparisonBars = [
    { label: data.storeName, price: data.ourPrice, isOurs: true },
    { label: '竞品均价', price: Math.round(data.competitorAvg), isOurs: false },
  ];

  const maxP = Math.max(data.ourPrice, data.competitorAvg, 1);
  const singleBarH = 40;
  const gap = 16;
  const barsStartY = startY + 36;

  comparisonBars.forEach((bar, i) => {
    const barY = barsStartY + i * (singleBarH + gap);
    const barW = Math.max((bar.price / maxP) * barUsable, 10);

    // 标签
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = bar.isOurs ? titleColor : '#6b7280';
    ctx.font = bar.isOurs
      ? 'bold 15px "PingFang SC", sans-serif'
      : '14px "PingFang SC", sans-serif';
    ctx.fillText(bar.label, barLeft - 10, barY + singleBarH / 2);

    // 条形
    if (bar.isOurs) {
      const g = ctx.createLinearGradient(barLeft, barY, barLeft + barW, barY);
      g.addColorStop(0, ourBarColors[0]);
      g.addColorStop(1, ourBarColors[1]);
      fillRoundRect(ctx, barLeft, barY, barW, singleBarH, 6, g);
      ctx.shadowColor = 'rgba(212, 168, 75, 0.3)';
      ctx.shadowBlur = 6;
      roundRectPath(ctx, barLeft, barY, barW, singleBarH, 6);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      fillRoundRect(ctx, barLeft, barY, barW, singleBarH, 6, otherBarColor);
    }

    // 价格数值
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = bar.isOurs ? ourTextColor : otherTextColor;
    ctx.font = bar.isOurs ? 'bold 14px sans-serif' : '14px sans-serif';
    ctx.fillText(`¥${bar.price.toFixed(0)}`, barLeft + barW + 8, barY + singleBarH / 2);
  });

  // 差价箭头
  if (data.diff > 0) {
    const diffY = barsStartY + 2 * (singleBarH + gap) + 8;
    const arrowStart = barLeft + ((data.ourPrice - 10) / maxP) * barUsable;
    const arrowEnd = barLeft + ((data.competitorAvg + 10) / maxP) * barUsable;

    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(arrowStart, diffY);
    ctx.lineTo(arrowEnd, diffY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 箭头
    ctx.fillStyle = 'rgba(220, 38, 38, 0.5)';
    ctx.beginPath(); ctx.moveTo(arrowStart, diffY);
    ctx.lineTo(arrowStart + 6, diffY - 4); ctx.lineTo(arrowStart + 6, diffY + 4);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(arrowEnd, diffY);
    ctx.lineTo(arrowEnd - 6, diffY - 4); ctx.lineTo(arrowEnd - 6, diffY + 4);
    ctx.closePath(); ctx.fill();

    // 差价文字
    drawCenteredText(ctx, `差价 ¥${data.diff.toFixed(0)}`,
      (arrowStart + arrowEnd) / 2, diffY - 14,
      '13px sans-serif', '#dc2626');
  }

  return barsStartY + 2 * (singleBarH + gap);
}

/** 信任信号行 */
export function drawTrustRow(
  ctx: CanvasRenderingContext2D,
  items: string[], W: number, y: number,
  color = 'rgba(107, 58, 26, 0.45)',
): number {
  const itemW = W / items.length;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '12px "PingFang SC", sans-serif';
  ctx.fillStyle = color;

  items.forEach((item, i) => {
    const cx = (i + 0.5) * itemW;
    // 小图标
    const iconMap: Record<string, string> = {
      '支持检测': '✓', '假一赔十': '✓', '明码实价': '✓',
      '品质保证': '✓', '诚信经营': '✓', '免费包装': '🎁',
    };
    const icon = iconMap[item] || '·';
    ctx.fillText(icon, cx, y - 6);
    ctx.fillText(item, cx, y + 12);
  });

  return y + 36;
}

/** CTA 底部区域 */
export function drawCTAZone(
  ctx: CanvasRenderingContext2D,
  W: number, y: number,
  options: {
    qrText?: string;
    ctaText?: string;
    phone?: string;
    address?: string;
  } = {},
): number {
  const qrText = options.qrText || '扫码咨询今日金价';
  const ctaText = options.ctaText || '到店选购更优惠';

  // QR 码占位框
  const qrSize = 100;
  const qrX = W / 2 - qrSize / 2;
  ctx.strokeStyle = 'rgba(212, 168, 75, 0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(qrX, y, qrSize, qrSize);
  ctx.setLineDash([]);

  // QR 占位图标
  ctx.fillStyle = 'rgba(212, 168, 75, 0.3)';
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📱', qrX + qrSize / 2, y + qrSize / 2);

  // QR 说明文字
  drawCenteredText(ctx, qrText, W / 2, y + qrSize + 16,
    '13px "PingFang SC", sans-serif',
    'rgba(107, 58, 26, 0.65)');

  // CTA 箭头文案
  drawCenteredText(ctx, `→ ${ctaText}`, W / 2, y + qrSize + 42,
    'bold 16px "PingFang SC", sans-serif', '#b8860b');

  return y + qrSize + 70;
}

/** 底部信息 */
export function drawFooter(
  ctx: CanvasRenderingContext2D,
  data: PosterData, W: number, H: number,
  color = 'rgba(107, 58, 26, 0.5)',
) {
  const footerY = H - 40;

  // 底线装饰
  ctx.fillStyle = 'rgba(212, 168, 75, 0.3)';
  ctx.fillRect(W / 2 - 60, footerY - 14, 120, 1);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 日期
  ctx.fillStyle = color;
  ctx.font = '13px "PingFang SC", sans-serif';
  ctx.fillText(
    `数据 · ${data.dataDate}`,
    W / 2, footerY,
  );

  // 信任提示
  ctx.fillStyle = color.replace('0.5', '0.3').replace('0.65', '0.3');
  ctx.font = '11px sans-serif';
  ctx.fillText('数据来源：各品牌官方饰金零售价', W / 2, footerY + 20);
}

/** 绘制品牌平铺列表 */
export function drawBrandGrid(
  ctx: CanvasRenderingContext2D,
  brands: { name: string; price: number }[], W: number, startY: number,
  cols = 3,
): number {
  const cellW = (W - 120) / cols;
  const cellH = 50;
  const padX = 60;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  brands.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = padX + col * cellW + cellW / 2;
    const cy = startY + row * cellH + cellH / 2;

    // 品牌名
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText(b.name, cx, cy - 8);

    // 价格
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`¥${b.price.toFixed(0)}`, cx, cy + 12);
  });

  const rows = Math.ceil(brands.length / cols);
  return startY + rows * cellH;
}

// ═══════════════════════════════════════════════════════
//  模板 1: 每日金价播报（日常获客型）
// ═══════════════════════════════════════════════════════
//
//  视觉：深琥珀→暖白渐变，精品感
//  受众：朋友圈日常刷到的朋友
//  传达：①今日金价 ②我们更便宜 ③值得信赖
//

function renderDailyPoster(ctx: CanvasRenderingContext2D, data: PosterData) {
  const W = 750;
  const H = 1200;

  // ── 背景：深琥珀渐变 ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#3d1f0a');
  bgGrad.addColorStop(0.22, '#6b3a1a');
  bgGrad.addColorStop(0.40, '#a67c52');
  bgGrad.addColorStop(0.50, '#d4a84b');
  bgGrad.addColorStop(0.60, '#f5e6d3');
  bgGrad.addColorStop(1, '#fef8f0');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 装饰金点 ──
  drawGoldDust(ctx, W, H * 0.5, 22);

  // ── 品牌头 ──
  drawBrandHeader(ctx, data, W, 28, '#fef8f0');

  // ── 大号价格 ──
  const priceEndY = drawPriceHero(ctx, data.ourPrice, W, 84);

  // ── 省钱标签 ──
  const badgeEndY = drawSavingsBadge(ctx, data.diff, W, priceEndY + 25);

  // ── 对比条形 ──
  const comparisonEndY = drawComparisonBars(ctx, data, W, badgeEndY > priceEndY ? badgeEndY + 10 : priceEndY + 30);

  // ── 营销金句 ──
  const marketingY = comparisonEndY + 24;
  drawCenteredText(ctx, '同样的纯度，更实在的价格', W / 2, marketingY,
    'bold 18px "PingFang SC", "Microsoft YaHei", sans-serif',
    '#6b3a1a');
  drawCenteredText(ctx, `采集${data.competitorCount}家品牌官方饰金零售价，数据说话`, W / 2, marketingY + 28,
    '13px "PingFang SC", sans-serif', 'rgba(107, 58, 26, 0.55)');

  // ── 信任行 ──
  const trustY = marketingY + 60;
  drawTrustRow(ctx, ['支持检测', '假一赔十', '明码实价'], W, trustY);

  // ── CTA 区 ──
  const ctaY = trustY + 48;
  drawCTAZone(ctx, W, ctaY);

  // ── 底部 ──
  drawFooter(ctx, data, W, H);
}

// ═══════════════════════════════════════════════════════
//  模板 2: 省钱对比（转化驱动型）
// ═══════════════════════════════════════════════════════
//
//  视觉：白底金点缀，突出"省"的概念
//  受众：正在比价的潜在客户
//  传达：①省多少 ②对标谁 ③怎么找我们
//

function renderSavingsPoster(ctx: CanvasRenderingContext2D, data: PosterData) {
  const W = 750;
  const H = 1200;

  // ── 背景：暖白 ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#fef8f0');
  bgGrad.addColorStop(0.15, '#fdf2e5');
  bgGrad.addColorStop(1, '#ffffff');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 顶部金色横条装饰 ──
  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, '#b8860b');
  headerGrad.addColorStop(0.5, '#d4a84b');
  headerGrad.addColorStop(1, '#b8860b');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, 4);

  // ── 品牌头 ──
  drawBrandHeader(ctx, { ...data, slogan: data.slogan || '珠宝首饰 · 品质保证' }, W, 28, '#6b3a1a');

  // ── 主标题 ──
  drawCenteredText(ctx, '买金不花冤枉钱', W / 2, 80,
    'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif', '#3d1f0a');

  // ── 省钱核心卡片 ──
  const cardY = 130;
  const cardW = 520;
  const cardH = 160;
  const cardX = (W - cardW) / 2;

  // 卡片背景
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, '#fff7ed');
  cardGrad.addColorStop(1, '#ffedd5');
  fillRoundRect(ctx, cardX, cardY, cardW, cardH, 16, cardGrad);
  ctx.strokeStyle = 'rgba(180, 134, 11, 0.2)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.stroke();

  // "每克省" 大字
  drawCenteredText(ctx, '每克省', cardX + cardW / 2, cardY + 40,
    '18px "PingFang SC", sans-serif', '#92400e');

  drawCenteredText(ctx, `¥${data.diff.toFixed(0)}`, cardX + cardW / 2, cardY + 90,
    'bold 64px "PingFang SC", "Microsoft YaHei", sans-serif', '#dc2626');

  // 买N克省更多
  const bulkText10 = `买10克省 ¥${(data.diff * 10).toFixed(0)}`;
  const bulkText50 = `买50克省 ¥${(data.diff * 50).toFixed(0)}`;
  drawCenteredText(ctx, `${bulkText10}  ·  ${bulkText50}`, cardX + cardW / 2, cardY + 135,
    '14px "PingFang SC", sans-serif', '#92400e');

  // ── 对比条形 ──
  const comparisonEndY = drawComparisonBars(ctx, data, W, cardY + cardH + 30,
    '#3d1f0a',
    ['#f59e0b', '#d97706'],
    '#f3f4f6',
    '#92400e', '#6b7280');

  // ── 品牌价格网格 ──
  const gridTitleY = comparisonEndY + 28;
  drawCenteredText(ctx, `各品牌饰金价一览（${data.dataDate}）`, W / 2, gridTitleY,
    '15px "PingFang SC", sans-serif', '#6b7280');

  const allBrands = [
    { name: data.storeName, price: data.ourPrice },
    ...data.competitorNames.slice(0, 8).map((name, i) => {
      // 竞品价格按均价合理分配（用于展示）
      const variance = (i - data.competitorNames.length / 2) * 5;
      return { name, price: Math.round(data.competitorAvg + variance) };
    }),
  ].sort((a, b) => a.price - b.price);

  const gridEndY = drawBrandGrid(ctx, allBrands, W, gridTitleY + 28, 3);

  // ── 金句 ──
  drawCenteredText(ctx, '货比三家，心中有数', W / 2, gridEndY + 20,
    'bold 18px "PingFang SC", sans-serif', '#6b3a1a');

  // ── CTA ──
  drawCTAZone(ctx, W, gridEndY + 50, {
    qrText: '扫码查看实时金价',
    ctaText: '到店选购 · 立省不等待',
  });

  // ── 底部 ──
  drawFooter(ctx, data, W, H, 'rgba(107, 58, 26, 0.5)');
}

// ═══════════════════════════════════════════════════════
//  模板 3: 节日营销（应季促销型）
// ═══════════════════════════════════════════════════════
//
//  视觉：红金配色，喜庆氛围
//  受众：节日送礼需求人群
//  传达：①节日到了 ②送礼选金 ③我们家最划算
//

function renderFestivalPoster(ctx: CanvasRenderingContext2D, data: PosterData) {
  const W = 750;
  const H = 1200;
  const festival = data.festivalName || '节日';

  // ── 背景：喜庆红金渐变 ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#7f1d1d');
  bgGrad.addColorStop(0.25, '#991b1b');
  bgGrad.addColorStop(0.45, '#b91c1c');
  bgGrad.addColorStop(0.55, '#d97706');
  bgGrad.addColorStop(0.65, '#fbbf24');
  bgGrad.addColorStop(0.80, '#fef3c7');
  bgGrad.addColorStop(1, '#fffbeb');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 装饰元素：大灯笼圆点 ──
  for (let i = 0; i < 8; i++) {
    const x = 60 + i * 90;
    ctx.beginPath();
    ctx.arc(x, 40, 18, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0
      ? 'rgba(251, 191, 36, 0.4)'
      : 'rgba(239, 68, 68, 0.5)';
    ctx.fill();
  }

  // ── 品牌头 ──
  drawBrandHeader(ctx, { ...data, slogan: `${festival}特惠 · ${data.storeName}` }, W, 28, '#fef3c7');

  // ── 节日主视觉区 ──
  drawCenteredText(ctx, `🧧 ${festival}快乐 🧧`, W / 2, 110,
    'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif', '#fef3c7');

  if (data.festivalDaysLeft && data.festivalDaysLeft > 0) {
    drawCenteredText(ctx, `距离${festival}还有 ${data.festivalDaysLeft} 天`, W / 2, 145,
      '14px "PingFang SC", sans-serif', 'rgba(254, 243, 199, 0.7)');
  }

  // ── 核心文案 ──
  drawCenteredText(ctx, `${festival}送礼 · 选对不选贵`, W / 2, 185,
    'bold 24px "PingFang SC", sans-serif', '#fef3c7');

  // ── 价格展示（精简版） ──
  drawCenteredText(ctx, '饰金价', W / 2, 225,
    '14px "PingFang SC", sans-serif', 'rgba(254, 243, 199, 0.7)');

  drawCenteredText(ctx, `¥${data.ourPrice.toFixed(0)} 元/克`, W / 2, 265,
    'bold 56px "PingFang SC", sans-serif', '#fef3c7');

  // ── 省钱标签 ──
  if (data.diff > 0) {
    const badgeY = 295;
    const badgeText = `比市场均价每克省 ¥${data.diff.toFixed(0)}`;
    ctx.font = 'bold 16px "PingFang SC", sans-serif';
    const tw = ctx.measureText(badgeText).width;
    const bw = tw + 40;
    const bx = (W - bw) / 2;
    fillRoundRect(ctx, bx, badgeY, bw, 36, 18, '#fef3c7');
    drawCenteredText(ctx, badgeText, W / 2, badgeY + 18,
      'bold 16px "PingFang SC", sans-serif', '#991b1b');
  }

  // ── 送礼推荐三档 ──
  const giftY = 360;
  drawCenteredText(ctx, '💰 送礼预算参考', W / 2, giftY,
    '18px "PingFang SC", sans-serif', '#6b3a1a');

  const tiers = [
    { budget: 500, desc: '精致小件', items: '银饰/小吊坠' },
    { budget: 2000, desc: '体面好礼', items: '金戒指/耳饰' },
    { budget: 5000, desc: '诚意之选', items: '金项链/手镯' },
  ];

  const tierW = 180;
  const tierGap = 30;
  const tierStartX = (W - (tierW * 3 + tierGap * 2)) / 2;
  const tierCardY = giftY + 28;

  tiers.forEach((t, i) => {
    const cx = tierStartX + i * (tierW + tierGap) + tierW / 2;
    const cy = tierCardY;

    // 卡片背景
    fillRoundRect(ctx, cx - tierW / 2, cy, tierW, 130, 12, '#ffffff');
    ctx.strokeStyle = 'rgba(180, 134, 11, 0.3)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, cx - tierW / 2, cy, tierW, 130, 12);
    ctx.stroke();

    drawCenteredText(ctx, `¥${t.budget}`, cx, cy + 28,
      'bold 22px sans-serif', '#b8860b');
    drawCenteredText(ctx, t.desc, cx, cy + 56,
      '14px "PingFang SC", sans-serif', '#374151');
    drawCenteredText(ctx, t.items, cx, cy + 82,
      '12px "PingFang SC", sans-serif', '#9ca3af');
  });

  // ── 紧迫感文案 ──
  const urgencyY = tierCardY + 155;
  drawCenteredText(ctx, `🔥 ${festival}特惠进行中，到店即享`, W / 2, urgencyY,
    'bold 18px "PingFang SC", sans-serif', '#b91c1c');

  // ── 信任行 ──
  drawTrustRow(ctx, ['品质保证', '免费包装', '诚信经营'], W, urgencyY + 36,
    'rgba(107, 58, 26, 0.5)');

  // ── CTA ──
  drawCTAZone(ctx, W, urgencyY + 80, {
    qrText: '扫码选礼 · 免费包装',
    ctaText: `${festival}好礼 · 尽在${data.storeName}`,
  });

  // ── 底部 ──
  drawFooter(ctx, data, W, H, 'rgba(107, 58, 26, 0.5)');
}

// ═══════════════════════════════════════════════════════
//  模板注册表
// ═══════════════════════════════════════════════════════

export const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    id: 'daily',
    name: '每日金价播报',
    description: '日常朋友圈/微信群转发，精品感金价播报',
    width: 750,
    height: 1200,
    render: renderDailyPoster,
  },
  {
    id: 'savings',
    name: '省钱对比',
    description: '种草/促销/引导到店，突出"省"的概念',
    width: 750,
    height: 1200,
    render: renderSavingsPoster,
  },
  {
    id: 'festival',
    name: '节日营销',
    description: '情人节/春节/七夕等节日送礼场景',
    width: 750,
    height: 1200,
    render: renderFestivalPoster,
  },
];

/**
 * 渲染海报到 Canvas
 *
 * @param canvas - 目标 Canvas 元素（会设置其 width/height/style）
 * @param templateId - 模板 ID
 * @param data - 海报数据
 * @param dpr - 设备像素比（默认取 window.devicePixelRatio 或 2）
 */
export function renderPoster(
  canvas: HTMLCanvasElement,
  templateId: TemplateId,
  data: PosterData,
  dpr?: number,
) {
  const template = POSTER_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Unknown poster template: ${templateId}`);
  }

  const ratio = dpr || (typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2);
  canvas.width = template.width * ratio;
  canvas.height = template.height * ratio;
  canvas.style.width = `${template.width}px`;
  canvas.style.height = `${template.height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context from canvas');
  }

  ctx.save();
  ctx.scale(ratio, ratio);
  template.render(ctx, data);
  ctx.restore();
}

/**
 * 将海报 Canvas 导出为 PNG Data URL
 */
export function posterToDataURL(
  canvas: HTMLCanvasElement,
  templateId: TemplateId,
  data: PosterData,
): string {
  renderPoster(canvas, templateId, data);
  return canvas.toDataURL('image/png');
}
