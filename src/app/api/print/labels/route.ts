import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError, ValidationError } from '@/lib/errors';

/**
 * 微打标签打印 API
 *
 * 为微打 App「远程数据」功能提供 JSON 数据接口。
 * 微打通过远程 URL 拉取数据后，绑定标签模板字段即可批量打印。
 *
 * 查询参数：
 *   keyword   - 按 SKU/名称搜索（可选）
 *   materialId - 按材质筛选（可选）
 *   typeId    - 按器型筛选（可选）
 *   status    - 按状态筛选，默认 in_stock（可选）
 *   limit     - 返回条数，默认 50，上限 200（可选）
 *
 * 返回字段映射到微打模板：
 *   商品名称   → name
 *   售价       → sellingPrice（贵金属填克重 weight）
 *   规格       → spec（手镯=圈口，戒指=戒圈，贵金属=克重）
 *   条码       → skuCode（CODE-128 格式）
 */

// 合法的货品状态值
const VALID_STATUSES = ['in_stock', 'sold', 'returned'];

// 判断材质是否为贵金属
function isPreciousMetal(category: string | null | undefined): boolean {
  return category === '贵金属';
}

// 根据器型提取规格显示值
function getSpecDisplay(
  typeName: string | null | undefined,
  category: string | null | undefined,
  spec: { weight?: number | null; braceletSize?: string | null; ringSize?: string | null; size?: string | null; beadDiameter?: string | null; beadCount?: number | null } | null,
): string {
  if (!spec) return '';

  // 手镯 → 圈口
  if (typeName?.includes('手镯') && spec.braceletSize) {
    return `圈口 ${spec.braceletSize}`;
  }
  // 戒指 → 戒圈
  if (typeName?.includes('戒指') && spec.ringSize) {
    return `戒圈 ${spec.ringSize}`;
  }
  // 贵金属 → 克重
  if (isPreciousMetal(category) && spec.weight) {
    return `克重 ${spec.weight}g`;
  }
  // 通用：有克重显示克重
  if (spec.weight) {
    return `克重 ${spec.weight}g`;
  }
  // 通用：有尺寸显示尺寸
  if (spec.size) {
    return `尺寸 ${spec.size}`;
  }
  // 通用：有珠径显示
  if (spec.beadDiameter) {
    const count = spec.beadCount ? ` ${spec.beadCount}颗` : '';
    return `珠径 ${spec.beadDiameter}${count}`;
  }

  return '';
}

// 转义 LIKE 通配符，防止意外匹配
function escapeLikeWildcard(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}

// 安全解析整数查询参数，返回 null 表示不传
function parseIntParam(raw: string | null): number | null {
  if (raw === null || raw === '') return null;
  const n = parseInt(raw, 10);
  if (isNaN(n)) throw new ValidationError(`无效的数字参数: ${raw}`);
  return n;
}

export async function GET(req: Request) {
  const denied = await guardPermission(req, 'action:item_view');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get('keyword');
    const materialId = parseIntParam(searchParams.get('materialId'));
    const typeId = parseIntParam(searchParams.get('typeId'));
    const status = searchParams.get('status') || 'in_stock';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    // 校验 status 合法性
    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError(`无效的状态值: ${status}，合法值: ${VALID_STATUSES.join(', ')}`);
    }

    // 构建 Prisma 强类型查询条件
    const where: Prisma.ItemWhereInput = { isDeleted: false, status };

    if (materialId !== null) where.materialId = materialId;
    if (typeId !== null) where.typeId = typeId;

    if (keyword) {
      const safe = escapeLikeWildcard(keyword.slice(0, 100));
      where.OR = [
        { skuCode: { contains: safe } },
        { name: { contains: safe } },
      ];
    }

    const items = await db.item.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, category: true } },
        type: { select: { id: true, name: true, specFields: true } },
        spec: { select: { weight: true, braceletSize: true, ringSize: true, size: true, beadDiameter: true, beadCount: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const result = items.map(item => {
      const isMetal = isPreciousMetal(item.material?.category);

      return {
        商品名称: item.name || `${item.material?.name || ''} ${item.type?.name || ''}`.trim(),
        售价: isMetal && item.spec?.weight
          ? String(item.spec.weight)
          : String(item.sellingPrice),
        规格: getSpecDisplay(item.type?.name, item.material?.category, item.spec),
        条码: item.skuCode || '',
      };
    });

    return NextResponse.json({
      code: 0,
      data: result,
      count: result.length,
      message: 'ok',
    });
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const message = safeErrorMessage(e);
    return NextResponse.json({ code: 500, data: null, message }, { status: 500 });
  }
}
