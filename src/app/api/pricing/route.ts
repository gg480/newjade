import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Pricing engine: suggest selling price based on cost
export async function POST(req: Request) {
  const body = await req.json();
  const { costPrice, materialId, typeId, weight } = body;

  if (!costPrice || costPrice <= 0) {
    return NextResponse.json({ code: 400, data: null, message: '请输入有效成本价' }, { status: 400 });
  }

  // Get pricing config from sys_config
  const configs = await db.sysConfig.findMany();
  const configMap: Record<string, string> = {};
  for (const c of configs) configMap[c.key] = c.value;

  const defaultMarkup = parseFloat(configMap['default_markup'] || '2.0'); // 默认加价倍数
  const minMarkup = parseFloat(configMap['min_markup'] || '1.3'); // 最低加价倍数
  const maxMarkup = parseFloat(configMap['max_markup'] || '5.0'); // 最高加价倍数

  // Adjust markup based on material type
  let markup = defaultMarkup;
  if (materialId) {
    const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
    if (material) {
      // Precious materials (gold, jade) get lower markup, common materials get higher
      const name = material.name.toLowerCase();
      if (name.includes('金') || name.includes('钻') || name.includes('钻石')) {
        markup = Math.max(minMarkup, defaultMarkup * 0.6);
      } else if (name.includes('玉') || name.includes('翡翠') || name.includes('和田')) {
        markup = Math.max(minMarkup, defaultMarkup * 1.2);
      } else if (name.includes('银') || name.includes('水晶')) {
        markup = Math.max(minMarkup, defaultMarkup * 1.5);
      }
    }
  }

  // Adjust markup based on cost tier
  if (costPrice >= 30000) {
    markup = Math.min(markup, 1.8); // 高货低倍率
  } else if (costPrice >= 10000) {
    markup = Math.min(markup, 2.5);
  } else if (costPrice >= 5000) {
    markup = Math.min(markup, 3.0);
  } else if (costPrice < 500) {
    markup = Math.max(markup, 3.0); // 低价货高倍率
  }

  // Clamp
  markup = Math.max(minMarkup, Math.min(maxMarkup, markup));

  const suggestedPrice = Math.round(costPrice * markup);
  const floorPrice = Math.round(costPrice * 1.1); // 底价 = 成本 * 1.1
  const grossProfit = suggestedPrice - costPrice;
  const grossMargin = grossProfit / suggestedPrice;

  // If weight provided and material has costPerGram, calculate metal component
  let metalCost = null;
  let laborCost = null;
  if (weight && materialId) {
    const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
    if (material?.costPerGram && weight > 0) {
      metalCost = Math.round(weight * material.costPerGram * 100) / 100;
      laborCost = Math.round((costPrice - metalCost) * 100) / 100;
    }
  }

  return NextResponse.json({
    code: 0,
    data: {
      costPrice,
      suggestedPrice,
      floorPrice,
      markup: Math.round(markup * 100) / 100,
      grossProfit,
      grossMargin: Math.round(grossMargin * 10000) / 100, // percentage with 2 decimals
      metalCost,
      laborCost,
    },
    message: 'ok',
  });
}
