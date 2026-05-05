import { db } from '@/lib/db';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import { logAction } from '@/lib/log';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

// ─── 图片存储路径 ───────────────────────────────────────────

const IMAGES_ROOT = process.env.NODE_ENV === 'production'
  ? path.join(process.env.DATA_DIR || '/app/data', 'images')
  : path.join(process.cwd(), 'public', 'images');

// ============================================================
// 图片管理
// ============================================================

/**
 * 上传货品图片
 * 保存文件到文件系统 + 创建 ItemImage 记录
 * 首张图片自动设为封面
 */
export async function uploadItemImage(itemId: number, file: File) {
  const item = await db.item.findUnique({ where: { id: itemId } });
  if (!item) throw new NotFoundError('货品不存在');

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError('仅支持 JPG/PNG/GIF/WEBP 格式');
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new ValidationError('图片大小不能超过10MB');
  }

  // Save file
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `item_${itemId}_${Date.now()}.${ext}`;

  // Ensure directory exists
  await mkdir(IMAGES_ROOT, { recursive: true });
  const filepath = path.join(IMAGES_ROOT, filename);
  await writeFile(filepath, buffer);

  // Check if this is the first image (make it cover)
  const existingImages = await db.itemImage.count({ where: { itemId } });

  // In DB, store the API path
  const dbPath = process.env.NODE_ENV === 'production'
    ? `/api/images/${filename}`
    : `/images/${filename}`;

  const imageRecord = await db.itemImage.create({
    data: {
      itemId,
      filename: dbPath,
      isCover: existingImages === 0,
    },
  });

  return imageRecord;
}

/**
 * 删除货品图片
 * 删除物理文件 + 删除 DB 记录
 * 如删除的是封面图，自动设置剩余第一张为封面
 */
export async function deleteItemImage(itemId: number, imageId: number) {
  const image = await db.itemImage.findUnique({ where: { id: imageId } });
  if (!image || image.itemId !== itemId) {
    throw new NotFoundError('图片不存在');
  }

  // Delete physical file
  try {
    const physicalFilename = image.filename.split('/').pop();
    if (physicalFilename) {
      const filepath = path.join(IMAGES_ROOT, physicalFilename);
      await unlink(filepath);
    }
  } catch {
    // ignore file not found
  }

  await db.itemImage.delete({ where: { id: imageId } });

  // If deleted image was cover, set first remaining as cover
  if (image.isCover) {
    const firstImage = await db.itemImage.findFirst({ where: { itemId } });
    if (firstImage) {
      await db.itemImage.update({ where: { id: firstImage.id }, data: { isCover: true } });
    }
  }
}

/**
 * 设置封面图片
 * 取消所有封面 → 设置指定图片为封面
 */
export async function setCoverImage(itemId: number, imageId: number) {
  // Unset all covers
  await db.itemImage.updateMany({ where: { itemId, isCover: true }, data: { isCover: false } });
  // Set new cover
  await db.itemImage.update({ where: { id: imageId }, data: { isCover: true } });
}

// ============================================================
// SKU 扫码查询
// ============================================================

/**
 * SKU 扫码查询 — 用于销售快速录入
 * @throws {NotFoundError} 货品不存在
 * @throws {ConflictError} 货品已售/已退
 */
export async function lookupItemBySku(sku: string) {
  const item = await db.item.findFirst({
    where: { skuCode: sku, isDeleted: false },
    include: { material: true, type: true, spec: true },
  });

  if (!item) {
    throw new NotFoundError('未找到该货品');
  }

  // Sales lookup only allows in-stock items to enter sell flow
  if (item.status !== 'in_stock') {
    const statusLabel = item.status === 'sold' ? '已售' : item.status === 'returned' ? '已退' : item.status;
    throw new ConflictError(`货品 ${item.skuCode} 当前状态为「${statusLabel}」，无法出库`);
  }

  return {
    id: item.id,
    skuCode: item.skuCode,
    name: item.name,
    materialName: item.material?.name,
    typeName: item.type?.name,
    costPrice: item.costPrice,
    allocatedCost: item.allocatedCost,
    sellingPrice: item.sellingPrice,
    floorPrice: item.floorPrice,
    status: item.status,
    counter: item.counter,
    weight: item.spec?.weight,
  };
}

// ============================================================
// 批量调价
// ============================================================

/**
 * 批量调价参数
 */
export interface BatchPriceAdjustInput {
  ids: string[];
  adjustmentType: 'percentage' | 'fixed';
  value: number;
  direction: 'increase' | 'decrease';
}

/**
 * 批量调整货品售价
 * 逐件更新并记录操作日志
 * @throws {ValidationError} 参数校验失败
 */
export async function batchAdjustPrice(input: BatchPriceAdjustInput) {
  const { ids, adjustmentType, value, direction } = input;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('请选择要调价的货品');
  }

  if (!['percentage', 'fixed'].includes(adjustmentType)) {
    throw new ValidationError('调整方式无效');
  }

  if (typeof value !== 'number' || isNaN(value) || value < 0) {
    throw new ValidationError('调整值无效');
  }

  if (!['increase', 'decrease'].includes(direction)) {
    throw new ValidationError('调整方向无效');
  }

  if (ids.length > 500) {
    throw new ValidationError('单次最多调整500件货品');
  }

  // Fetch all items
  const items = await db.item.findMany({
    where: { id: { in: ids.map(Number) } },
    select: { id: true, skuCode: true, sellingPrice: true, name: true },
  });

  if (items.length === 0) {
    throw new ValidationError('未找到选中货品');
  }

  let successCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const oldPrice = item.sellingPrice || 0;
      let newPrice: number;

      if (adjustmentType === 'percentage') {
        if (direction === 'increase') {
          newPrice = Math.round(oldPrice * (1 + value / 100));
        } else {
          newPrice = Math.round(oldPrice * (1 - value / 100));
        }
      } else {
        if (direction === 'increase') {
          newPrice = Math.round(oldPrice + value);
        } else {
          newPrice = Math.round(oldPrice - value);
        }
      }

      // Ensure price never goes below 0
      newPrice = Math.max(0, newPrice);

      await db.item.update({
        where: { id: item.id },
        data: { sellingPrice: newPrice },
      });

      successCount++;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`${item.skuCode}: ${message}`);
    }
  }

  await logAction('batch_price_adjust', 'item', 0, {
    count: successCount,
    adjustmentType,
    value,
    direction,
  });

  return { success: successCount, total: items.length, errors };
}

// ============================================================
// 清理已删除货品
// ============================================================

/**
 * 物理清除已软删除的货品（含关联的 tags/specs/images）
 */
export async function cleanupDeletedItems() {
  // Count how many will be deleted first
  const count = await db.item.count({ where: { isDeleted: true } });

  if (count === 0) {
    return { deleted: 0 };
  }

  // Get IDs of deleted items
  const itemIds = await db.item.findMany({
    where: { isDeleted: true },
    select: { id: true },
  });
  const ids = itemIds.map(i => i.id);

  // Delete related records
  await db.itemTag.deleteMany({ where: { itemId: { in: ids } } });
  await db.itemSpec.deleteMany({ where: { itemId: { in: ids } } });
  await db.itemImage.deleteMany({ where: { itemId: { in: ids } } });

  // Delete the items
  const result = await db.item.deleteMany({ where: { isDeleted: true } });

  return { deleted: result.count };
}

/**
 * 查询已删除货品数量
 */
export async function countDeletedItems() {
  const count = await db.item.count({ where: { isDeleted: true } });
  return { count };
}

// ============================================================
// 调价记录
// ============================================================

/** 调价记录查询参数 */
export interface PriceLogParams {
  itemId?: number;
  page?: number;
  size?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * 查询调价记录（分页）
 */
export async function getPriceChangeLogs(params: PriceLogParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const size = Math.min(100, Math.max(1, params.size ?? 20));

  const where: Record<string, unknown> = {};
  if (params.itemId) {
    where.itemId = params.itemId;
  }
  if (params.startDate) {
    where.createdAt = {
      ...(where.createdAt as object || {}),
      gte: new Date(params.startDate),
    };
  }
  if (params.endDate) {
    where.createdAt = {
      ...(where.createdAt as object || {}),
      lte: new Date(new Date(params.endDate).setHours(23, 59, 59, 999)),
    };
  }

  const [logs, total] = await Promise.all([
    db.priceChangeLog.findMany({
      where,
      include: { item: { select: { id: true, skuCode: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    db.priceChangeLog.count({ where }),
  ]);

  return { logs, total, page, size };
}
