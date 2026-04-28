import { withApiLogging } from '@/lib/api/with-api-logging';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

async function promotionForecastGet(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: promotionId } = await params;

  try {
    // Validate promotion exists
    const promotion = await db.promotion.findUnique({
      where: { id: parseInt(promotionId) },
      include: {
        items: {
          include: {
            item: {
              include: {
                saleRecords: true,
              },
            },
          },
        },
      },
    });

    if (!promotion) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }

    // Calculate base metrics
    const promotionItems = promotion.items.map(({ item }) => item);
    const itemIds = promotionItems.map(item => item.id);

    // Get historical sales data for these items
    const historicalSales = itemIds.length > 0 ? await db.saleRecord.findMany({
      where: {
        itemId: { in: itemIds },
        saleDate: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 90 days
        },
      },
      include: {
        item: true,
      },
    }) : [];

    // Calculate average daily sales before promotion
    const daysInPeriod = 90;
    const baseSalesCount = historicalSales.length;
    const baseSalesAmount = historicalSales.reduce((sum, sale) => sum + sale.actualPrice, 0);
    const baseDailySalesCount = baseSalesCount / daysInPeriod;
    const baseDailySalesAmount = baseSalesAmount / daysInPeriod;

    // Calculate average cost and profit (handle empty promotion items)
    const baseCost = promotionItems.length > 0
      ? promotionItems.reduce((sum, item) => sum + (item.allocatedCost || item.costPrice || 0), 0) / promotionItems.length
      : 0;

    const basePrice = promotionItems.length > 0
      ? promotionItems.reduce((sum, item) => sum + item.sellingPrice, 0) / promotionItems.length
      : 0;

    const baseProfitPerItem = basePrice - baseCost;

    // Predict sales growth based on promotion type
    let predictedSalesGrowth = 0;
    let predictedProfitChange = 0;
    let confidence = 0.5; // Base confidence

    if (promotion.type === 'discount' && promotion.discountValue) {
      // Discount promotion
      const discountRate = promotion.discountValue / 100;
      predictedSalesGrowth = Math.min(100, discountRate * 200); // Up to 100% growth
      const discountedPrice = basePrice * (1 - discountRate);
      const newProfitPerItem = discountedPrice - baseCost;
      const profitImpact = baseProfitPerItem !== 0 ? (newProfitPerItem - baseProfitPerItem) / baseProfitPerItem : 0;
      predictedProfitChange = (predictedSalesGrowth / 100 + 1) * (1 + profitImpact) - 1;
      confidence = Math.min(0.8, 0.5 + discountRate * 0.6);
    } else if (promotion.type === '满减' && promotion.condition && promotion.discountValue) {
      // 满减 promotion
      const discountAmount = promotion.discountValue;
      const threshold = promotion.condition;
      const discountRate = discountAmount / threshold;
      predictedSalesGrowth = Math.min(80, discountRate * 150); // Up to 80% growth
      const effectiveDiscountRate = discountAmount / (threshold + discountAmount);
      const discountedPrice = basePrice * (1 - effectiveDiscountRate);
      const newProfitPerItem = discountedPrice - baseCost;
      const profitImpact = baseProfitPerItem !== 0 ? (newProfitPerItem - baseProfitPerItem) / baseProfitPerItem : 0;
      predictedProfitChange = (predictedSalesGrowth / 100 + 1) * (1 + profitImpact) - 1;
      confidence = Math.min(0.75, 0.5 + discountRate * 0.5);
    } else if (promotion.type === '赠品') {
      // 赠品 promotion
      predictedSalesGrowth = 50; // 50% growth
      predictedProfitChange = 0.2; // 20% profit increase
      confidence = 0.6;
    } else if (promotion.type === '套餐') {
      // 套餐 promotion
      predictedSalesGrowth = 70; // 70% growth
      predictedProfitChange = 0.3; // 30% profit increase
      confidence = 0.65;
    }

    // Calculate predicted values
    const predictedDailySalesCount = baseDailySalesCount * (1 + predictedSalesGrowth / 100);
    const predictedDailySalesAmount = baseDailySalesAmount * (1 + predictedSalesGrowth / 100);
    const predictedDailyProfit = basePrice > 0
      ? baseDailySalesAmount * (baseProfitPerItem / basePrice) * (1 + predictedProfitChange)
      : baseDailySalesAmount * (1 + predictedProfitChange);

    // Calculate promotion duration
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);
    const promotionDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate total predicted values for the promotion period
    const totalPredictedSalesCount = predictedDailySalesCount * promotionDays;
    const totalPredictedSalesAmount = predictedDailySalesAmount * promotionDays;
    const totalPredictedProfit = predictedDailyProfit * promotionDays;

    // Save prediction to database
    const promotionEffect = await db.promotionEffect.create({
      data: {
        promotionId: parseInt(promotionId),
        predictedSalesGrowth,
        predictedProfitChange: predictedProfitChange * 100, // Store as percentage
        confidence,
      },
    });

    return NextResponse.json({
      code: 0,
      data: {
        promotionId: promotion.id,
        promotionName: promotion.name,
        promotionType: promotion.type,
        prediction: {
          salesGrowth: predictedSalesGrowth,
          profitChange: predictedProfitChange * 100,
          confidence,
          daily: {
            salesCount: predictedDailySalesCount,
            salesAmount: predictedDailySalesAmount,
            profit: predictedDailyProfit,
          },
          total: {
            salesCount: totalPredictedSalesCount,
            salesAmount: totalPredictedSalesAmount,
            profit: totalPredictedProfit,
            days: promotionDays,
          },
          base: {
            dailySalesCount: baseDailySalesCount,
            dailySalesAmount: baseDailySalesAmount,
            profitPerItem: baseProfitPerItem,
          },
        },
        effectId: promotionEffect.id,
        calculatedAt: promotionEffect.calculatedAt,
      },
      message: 'ok',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `预测失败: ${e.message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('promotions:forecast:GET', promotionForecastGet);
