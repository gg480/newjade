import { db } from '@/lib/db';
import { ValidationError } from '@/lib/errors';

// ============================================================
// 类型定义
// ============================================================

/** 定价计算请求参数 */
export interface CalculatePriceInput {
  costPrice: number;
  materialId?: string | null;
  typeId?: string | null;
  weight?: number | null;
}

/** 定价计算结果 */
export interface PriceCalculation {
  costPrice: number;
  suggestedPrice: number;
  floorPrice: number;
  markup: number;
  grossProfit: number;
  grossMargin: number;
  metalCost: number | null;
  laborCost: number | null;
}

// ============================================================
// 服务方法
// ============================================================

/**
 * 计算建议售价
 * 基于成本价 × 材质系数 × 成本阶梯，参考系统配置中的加价倍数
 * @throws {ValidationError} 成本价无效时抛出
 */
export async function calculatePrice(data: CalculatePriceInput): Promise<PriceCalculation> {
  const { costPrice, materialId, weight } = data;

  if (!costPrice || costPrice <= 0) {
    throw new ValidationError('请输入有效成本价');
  }

  // 获取定价配置
  const configs = await db.sysConfig.findMany();
  const configMap: Record<string, string> = {};
  for (const c of configs) configMap[c.key] = c.value;

  const defaultMarkup = parseFloat(configMap['default_markup'] || '2.0');
  const minMarkup = parseFloat(configMap['min_markup'] || '1.3');
  const maxMarkup = parseFloat(configMap['max_markup'] || '5.0');

  // 根据材质类型调整加价倍数
  let markup = defaultMarkup;
  if (materialId) {
    const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
    if (material) {
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

  // 根据成本阶梯调整加价倍数
  if (costPrice >= 30000) {
    markup = Math.min(markup, 1.8);
  } else if (costPrice >= 10000) {
    markup = Math.min(markup, 2.5);
  } else if (costPrice >= 5000) {
    markup = Math.min(markup, 3.0);
  } else if (costPrice < 500) {
    markup = Math.max(markup, 3.0);
  }

  // 夹紧到合法范围
  markup = Math.max(minMarkup, Math.min(maxMarkup, markup));

  const suggestedPrice = Math.round(costPrice * markup);
  const floorPrice = Math.round(costPrice * 1.1);
  const grossProfit = suggestedPrice - costPrice;
  const grossMargin = grossProfit / suggestedPrice;

  // 如果提供了重量和材质ID，计算金属成本和工费
  let metalCost: number | null = null;
  let laborCost: number | null = null;
  if (weight && materialId) {
    const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
    if (material?.costPerGram && weight > 0) {
      metalCost = Math.round(weight * material.costPerGram * 100) / 100;
      laborCost = Math.round((costPrice - metalCost) * 100) / 100;
    }
  }

  return {
    costPrice,
    suggestedPrice,
    floorPrice,
    markup: Math.round(markup * 100) / 100,
    grossProfit,
    grossMargin: Math.round(grossMargin * 10000) / 100,
    metalCost,
    laborCost,
  };
}
